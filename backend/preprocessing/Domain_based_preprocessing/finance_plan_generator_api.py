import pandas as pd
import json
import sys
import os
import argparse
import numpy as np
import re
import traceback
from difflib import get_close_matches
from typing import Dict, Any
from huggingface_hub import InferenceClient
from dotenv import load_dotenv

# ============================================================
# SYSTEM CONFIG & ENV
# ============================================================
def force_utf8_streams():
    try:
        if sys.stdout.encoding.lower() != 'utf-8':
            sys.stdout.reconfigure(encoding='utf-8')
        if sys.stderr.encoding.lower() != 'utf-8':
            sys.stderr.reconfigure(encoding='utf-8')
    except Exception: pass

force_utf8_streams()

def safe_log(message):
    try: print(message, file=sys.stderr, flush=True)
    except: pass

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

HF_TOKEN = os.getenv("HF_TOKEN")
HF_MODEL_SUMMARY = "meta-llama/Llama-3.2-3B-Instruct" 
HF_MODEL_LOGIC = "meta-llama/Llama-3.1-8B-Instruct"

try:
    client = InferenceClient(api_key=HF_TOKEN) if HF_TOKEN else None
except:
    client = None

# ============================================================
# UTILITIES
# ============================================================
def clean_json_text(text: str) -> str:
    if not text: return "{}"
    text = text.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'").replace('—', '-')
    text = re.sub(r'```json', '', text, flags=re.IGNORECASE)
    text = re.sub(r'```', '', text)
    text = re.sub(r'//.*', '', text)
    start = text.find('{')
    end = text.rfind('}')
    return text[start : end + 1] if start != -1 else text.strip()

def ask_hf_llm(prompt: str, model: str, temperature: float = 0.1) -> str:
    if not client: 
        safe_log("[Error] HF_TOKEN is missing. Cannot use API.")
        return ""
    try:
        safe_log(f"   [Step] Requesting HF API ({model})...")
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=4096,
        )
        return response.choices[0].message.content
    except Exception as e:
        safe_log(f"   [Error] HF LLM Error: {e}")
        return ""

# ============================================================
# FINANCE ENGINE (API BASED)
# ============================================================
class FinancePlanGenerator:
    def __init__(self):
        # Strict order to prevent math errors (Log before Scale)
        self.EXECUTION_PRIORITY = ["drop", "remove_duplicates", "impute", "outlier", "log", "polynomial", "encode", "scale", "normalize", "pca"]

        self.MODULE_LIBRARY = {
            "remove_duplicates": {"id": "dp1", "label": "Remove Duplicates (D)", "name": "remove_duplicates"},
            "impute": {"id": "dp2", "label": "Handle Missing Values (D)", "name": "handle_missing_values"},
            "outlier": {"id": "dp3", "label": "Outlier Removal (D)", "name": "outlier_removal_iqr"},
            "polynomial": {"id": "dp5", "label": "Polynomial Features (D)", "name": "polynomial_features"},
            "log": {"id": "dp6", "label": "Log Transform (D)", "name": "log_transform"},
            "encode": {"id": "dp7", "label": "Encoding (D)", "name": "encoding"},
            "scale": {"id": "dp8", "label": "Scaling (D)", "name": "scaling"},
            "normalize": {"id": "dp9", "label": "Normalization (D)", "name": "normalization"},
            "pca": {"id": "dp10", "label": "PCA (D)", "name": "pca"},
            "drop": {"id": "dp_drop", "label": "Drop Column", "name": "drop"}
        }

    def get_dataset_profile(self, df: pd.DataFrame) -> str:
        stats = []
        for col in df.columns:
            dtype = str(df[col].dtype)
            missing = int(df[col].isnull().sum())
            skew = 0
            if pd.api.types.is_numeric_dtype(df[col]):
                try: skew = df[col].skew()
                except: pass
            dist = "High Skew" if abs(skew) > 1.0 else "Normal"
            stats.append(f"Col: '{col}' | Type: {dtype} | Miss: {missing} | Dist: {dist} (Skew:{skew:.2f})")
        return "\n".join(stats)

    def generate_executive_summary(self, df: pd.DataFrame) -> str:
        safe_log("\n--- Phase 1: Risk Assessment ---")
        prompt = f"Role: Chief Risk Officer. Audit this financial dataset profile:\n{self.get_dataset_profile(df)}\nSummarize domain risks and data quality in 150 words."
        return ask_hf_llm(prompt, HF_MODEL_SUMMARY, temperature=0.3)

    def generate_detailed_strategy(self, df: pd.DataFrame, summary: str) -> str:
        safe_log("\n--- Phase 2: Quantitative Strategy ---")
        prompt = f"""
SYSTEM ROLE: Quantitative Data Scientist.
DATA PROFILE: {self.get_dataset_profile(df)}
CONTEXT: {summary}

FINANCIAL RULES FOR SEQUENCING:
1. MONETARY VALUES (Skew > 1.0): Sequence must be ["impute", "outlier", "log", "scale"].
   - Reason: Normalizing power-law monetary distribution is required for model stability.
2. RATIOS/RATES: Sequence must be ["impute", "scale"].
3. CATEGORICAL: Sequence must be ["encode"].
4. IDENTIFIERS: Sequence must be ["drop"].

List steps for each column.
"""
        return ask_hf_llm(prompt, HF_MODEL_LOGIC, temperature=0.1)

    def generate_json_plan(self, df: pd.DataFrame, detailed_strategy: str) -> Dict[str, Any]:
        safe_log("\n--- Phase 3: JSON Configuration ---")
        prompt = f"""
SYSTEM ROLE: MLOps Engine. Map strategy to JSON.
KEYS: Exact Column Names.
VALUES: {{ "actions": ["list", "of", "keys"], "reason": "justification" }}
VALID KEYS: drop, impute, outlier, log, encode, scale.

STRATEGY:
{detailed_strategy}
JSON ONLY:
"""
        raw = ask_hf_llm(prompt, HF_MODEL_LOGIC, temperature=0.0)
        try: data = json.loads(clean_json_text(raw))
        except: return {}

        final_plan = {}
        df_cols_lower = {c.lower(): c for c in df.columns}

        for llm_col, details in data.items():
            target_col = None
            if llm_col in df.columns: target_col = llm_col
            elif llm_col.lower() in df_cols_lower: target_col = df_cols_lower[llm_col.lower()]
            else:
                matches = get_close_matches(llm_col, df.columns, n=1, cutoff=0.7)
                if matches: target_col = matches[0]

            if not target_col: continue

            steps = []
            for act_name in details.get("actions", []):
                a = str(act_name).lower()
                key = None
                if "drop" in a: key = "drop"
                elif "impute" in a: key = "impute"
                elif "outlier" in a: key = "outlier"
                elif "log" in a: key = "log"
                elif "encode" in a: key = "encode"
                elif "scale" in a: key = "scale"

                if key: steps.append({"action": self.MODULE_LIBRARY[key]["name"], "moduleId": self.MODULE_LIBRARY[key]["id"], "label": self.MODULE_LIBRARY[key]["label"], "params": "auto"})

            # Sort to prevent Math Errors (Log before Scale)
            steps.sort(key=lambda x: self.EXECUTION_PRIORITY.index(next((k for k, v in self.MODULE_LIBRARY.items() if v["name"] == x['action']), 99)))

            final_plan[target_col] = {"steps": steps, "reason": details.get("reason", "Financial Quant Protocol.")}
        return final_plan

    def run(self, df: pd.DataFrame):
        summary = self.generate_executive_summary(df)
        strategy = self.generate_detailed_strategy(df, summary)
        plan = self.generate_json_plan(df, strategy)
        return { "plan": plan, "summary": summary, "strategy": strategy }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("file_path")
    parser.add_argument("--regenerate", default=None)
    args = parser.parse_args()
    try:
        df = pd.read_csv(args.file_path, sep=None, engine='python')
        gen = FinancePlanGenerator()
        if args.regenerate:
            print("__JSON_RESULT_START__")
            print(json.dumps({"plan": gen.generate_json_plan(df, args.regenerate)}))
            print("__JSON_RESULT_END__")
        else:
            print("__JSON_RESULT_START__")
            print(json.dumps(gen.run(df)))
            print("__JSON_RESULT_END__")
    except Exception as e:
        safe_log(traceback.format_exc())