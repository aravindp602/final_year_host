import pandas as pd
import json
import sys
import os
import argparse
import numpy as np
import re
import traceback
import requests
from typing import Dict, Any

# ============================================================
# SYSTEM CONFIG
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

# --- OLLAMA CONFIG ---
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2" 

# ============================================================
# UTILITIES
# ============================================================

def clean_json_text(text: str) -> str:
    if not text: return "{}"
    text = re.sub(r'```json', '', text, flags=re.IGNORECASE)
    text = re.sub(r'```', '', text)
    text = re.sub(r'//.*', '', text)
    text = re.sub(r',(\s*[}\]])', r'\1', text)
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        return text[start : end + 1]
    return text.strip()

def ask_ollama(prompt: str, temperature: float = 0.1) -> str:
    """Uses requests to call local Ollama API."""
    try:
        safe_log(f"   [Step] Requesting Ollama ({OLLAMA_MODEL})...")
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_ctx": 4096
            }
        }
        response = requests.post(OLLAMA_URL, json=payload, timeout=300)
        if response.status_code == 200:
            return response.json().get("response", "")
        else:
            safe_log(f"   [Error] Ollama returned status {response.status_code}")
            return ""
    except Exception as e:
        safe_log(f"   [Error] Connection to Ollama failed: {e}")
        return ""

# ============================================================
# FINANCE ENGINE
# ============================================================

class FinancePlanGenerator:
    def __init__(self):
        safe_log("[Init] Initializing Finance Engine (Ollama/Requests)...")
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

    # ---------------- DATA PROFILING ----------------

    def get_dataset_profile(self, df: pd.DataFrame) -> str:
        try:
            col_stats = []
            df_clean = df.replace([r'^\s*$', r'^\?$', r'^NA$', r'^nan$', r'^null$', r'^None$'], np.nan, regex=True)

            for col in df_clean.columns:
                dtype = str(df_clean[col].dtype)
                missing_count = int(df_clean[col].isnull().sum())
                unique = int(df_clean[col].nunique())
                
                skew_hint = ""
                if pd.api.types.is_numeric_dtype(df_clean[col]):
                    try:
                        skew = df_clean[col].skew()
                        if abs(skew) > 1.5: skew_hint = "(Heavy-Tail/Power Law)"
                    except: pass

                col_stats.append(f"VAR: '{col}' | Type: {dtype} | Missing: {missing_count} {skew_hint}")

            return "\n".join(col_stats)
        except Exception as e:
            safe_log(f"[Error] Profiling Failed: {e}")
            return "Dataset Profile Error"

    # ============================================================
    # PHASE 1: RISK ASSESSMENT
    # ============================================================

    def generate_executive_summary(self, df: pd.DataFrame) -> str:
        safe_log("\n--- Phase 1: Risk Assessment ---")
        profile = self.get_dataset_profile(df)

        prompt = f"""
SYSTEM ROLE:
You are a **Chief Risk Officer (CRO)** analyzing a financial dataset.

DATA PROFILE:
{profile}

INSTRUCTIONS:
Write a 200-word Risk Assessment covering:
1.  **Financial Domain**: (e.g., Credit Risk, Fraud Detection, Market Trading).
2.  **Data Quality**: Discuss missing financial records and heavy-tailed monetary values.
3.  **Statistical Challenges**: Highlight high cardinality categorical data or potential outliers.

TONE: Professional and Quantitative.
"""
        return ask_ollama(prompt, temperature=0.3)

    # ============================================================
    # PHASE 2: QUANTITATIVE STRATEGY
    # ============================================================

    def generate_detailed_strategy(self, df: pd.DataFrame, executive_summary: str) -> str:
        safe_log("\n--- Phase 2: Quantitative Strategy ---")
        profile = self.get_dataset_profile(df)

        prompt = f"""
SYSTEM ROLE:
You are a **Quantitative Data Scientist**. Design a **Multi-Step Preprocessing Pipeline**.

AVAILABLE MODULES:
- dp1: Remove Duplicates
- dp2: Handle Missing Values (Imputation)
- dp3: Outlier Removal
- dp6: Log Transform
- dp7: Encoding
- dp8: Scaling
- dp_drop: Drop Column
- dp9: Normalization
- dp10: PCA
- dp5: Polynomial Features

DATA PROFILE:
{profile}

### QUANTITATIVE RULES (Apply Strictly):

1.  **MONETARY VALUES & HEAVY TAILS** (Skew > 1.0) (e.g., Annual Income, Transaction Amount, Debt):
    * *Sequence*: `["impute", "outlier", "log", "scale"]`
    * *Reason*: "1. Impute missing data. 2. Cap extreme outliers (winsorize) to prevent volatility. 3. Log-transform to normalize power-law distribution common in finance. 4. Scale to standardize for regression/neural nets."

2.  **FINANCIAL RATIOS / PERCENTAGES** (e.g., Interest Rate, Utilization):
    * *Sequence*: `["impute", "scale"]`
    * *Reason*: "Ratios are bounded. Imputation fills gaps; Scaling aligns variance with other features."

3.  **CATEGORICAL RISK FACTORS** (e.g., Loan Grade, Home Ownership):
    * *Sequence*: `["encode"]`
    * *Reason*: "Convert nominal/ordinal risk factors into numeric vectors."

4.  **ADMINISTRATIVE** (IDs, Names, UUIDs):
    * *Sequence*: `["drop"]`
    * *Reason*: "Identifier with no predictive signal."

OUTPUT FORMAT (Markdown):
For each column, list the **Steps** and the **Quantitative Justification**.
"""
        return ask_ollama(prompt, temperature=0.1)

    # ============================================================
    # PHASE 3: JSON MAPPING
    # ============================================================

    def _robust_json_generation(self, prompt: str) -> Dict[str, Any]:
        for attempt in range(3):
            if attempt > 0: safe_log(f"   [Retry] JSON Parse attempt {attempt+1}...")
            raw = ask_ollama(prompt, temperature=0.1)
            clean = clean_json_text(raw)
            try:
                data = json.loads(clean)
                if len(data.keys()) > 0: return data
            except: pass
        return {}

    def _normalize_plan(self, data: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {}
        for col, info in data.items():
            if not isinstance(info, dict): continue
            
            raw_actions_list = info.get("actions", [])
            if isinstance(raw_actions_list, str): raw_actions_list = [raw_actions_list]
            
            if len(raw_actions_list) == 1 and "," in raw_actions_list[0]:
                raw_actions_list = [x.strip() for x in raw_actions_list[0].split(",")]

            normalized_actions = []
            for raw_action in raw_actions_list:
                act_str = str(raw_action).lower().strip()
                module_key = None
                final_params = "null"

                if "duplicate" in act_str: module_key = "remove_duplicates"
                elif "impute" in act_str or "missing" in act_str:
                    module_key = "impute"
                    final_params = "iterative" 
                elif "outlier" in act_str: module_key = "outlier"
                elif "log" in act_str: module_key = "log"
                elif "drop" in act_str: module_key = "drop"
                elif "encode" in act_str:
                    module_key = "encode"
                    final_params = "one_hot_encoder"
                elif "scale" in act_str:
                    module_key = "scale"
                    final_params = "standard_scaler"
                elif "normal" in act_str: module_key = "normalize"
                elif "pca" in act_str: module_key = "pca"

                if module_key:
                    mod_info = self.MODULE_LIBRARY.get(module_key, {})
                    if mod_info:
                        normalized_actions.append({
                            "action": module_key,
                            "moduleId": mod_info["id"],
                            "label": mod_info["label"],
                            "params": final_params
                        })

            if normalized_actions:
                normalized[col] = {
                    "steps": normalized_actions,
                    "reason": info.get("reason", "Financial quantitative protocol.")
                }
        return normalized

    def generate_json_plan(self, df: pd.DataFrame, detailed_strategy: str) -> Dict[str, Any]:
        safe_log("\n--- Phase 3: JSON Configuration ---")
        profile = self.get_dataset_profile(df)

        prompt = f"""
SYSTEM ROLE:
You are an MLOps Engine. Map the strategy to JSON.

DATA PROFILE:
{profile}

STRATEGY:
{detailed_strategy}

INSTRUCTIONS:
1. Return a JSON dictionary. Keys = Column Names.
2. Values = Object with "actions" (List of strings) and "reason" (String).
3. Copy the reasoning verbatim.

OUTPUT EXAMPLE:
{{
  "Annual_Income": {{
    "actions": ["impute", "outlier", "log", "scale"],
    "reason": "Log-transform handles the long tail, followed by Scaling."
  }}
}}
"""
        data = self._robust_json_generation(prompt)
        normalized = self._normalize_plan(data)
        return normalized

    def run(self, df: pd.DataFrame):
        summary = self.generate_executive_summary(df)
        strategy = self.generate_detailed_strategy(df, summary)
        plan = self.generate_json_plan(df, strategy)
        return { "plan": plan, "summary": summary, "strategy": strategy }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("file_path", help="Path to CSV")
    parser.add_argument("--regenerate", help="Report text", default=None)
    args = parser.parse_args()

    try:
        try: raw_df = pd.read_csv(args.file_path, sep=None, engine='python')
        except: raw_df = pd.read_csv(args.file_path)

        generator = FinancePlanGenerator()

        if args.regenerate:
            plan = generator.generate_json_plan(raw_df, args.regenerate)
            result = { "plan": plan }
            print("__JSON_RESULT_START__")
            print(json.dumps(result))
            print("__JSON_RESULT_END__")
        else:
            result = generator.run(raw_df)
            print("__JSON_RESULT_START__")
            print(json.dumps(result))
            print("__JSON_RESULT_END__")

    except Exception as e:
        safe_log(f"[Error] Execution Failed: {e}")
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)