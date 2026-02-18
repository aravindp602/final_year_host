import pandas as pd
import json
import sys
import os
import argparse
import numpy as np
import re
import traceback
import requests
import ast
from typing import Dict, Any, List
from dotenv import load_dotenv

# ============================================================
# UTF-8 SAFETY
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

# ============================================================
# CONFIGURATION
# ============================================================
load_dotenv()
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2" 

# ============================================================
# LLM API
# ============================================================
def ask_llm(prompt: str, temperature: float = 0.2) -> str:
    try:
        response = requests.post(OLLAMA_URL, json={
            "model": OLLAMA_MODEL, "prompt": prompt, "temperature": temperature, "stream": False,
            "options": {"num_ctx": 8192}
        }, timeout=300)
        return response.json().get("response", "").strip() if response.status_code == 200 else ""
    except Exception as e:
        safe_log(f"   [Error] Connection failed: {e}")
        return ""

def ask_llm_json(prompt: str, temperature: float = 0.1) -> str:
    try:
        response = requests.post(OLLAMA_URL, json={
            "model": OLLAMA_MODEL, "prompt": prompt, "format": "json", 
            "temperature": temperature, "stream": False,
            "options": {"num_ctx": 8192}
        }, timeout=300)
        return response.json().get("response", "{}") if response.status_code == 200 else "{}"
    except Exception: return "{}"

# ============================================================
# UTILITIES
# ============================================================
def safe_parse_json(text: str) -> Dict:
    start, end = text.find('{'), text.rfind('}')
    cleaned = text[start : end + 1] if start != -1 else text
    try: return json.loads(cleaned)
    except:
        try: return ast.literal_eval(cleaned)
        except: return {}

def clean_strategy_text(text: str) -> str:
    if not text: return ""
    return re.sub(r'([^*])\*([^*]+)\*', r'\1\2', re.sub(r'\*\*(.*?)\*\*', r'\1', text)).replace("`", "")

# ============================================================
# CORE ENGINE - FINANCE
# ============================================================
class FinancePlanGenerator:
    def __init__(self):
        safe_log("[Init] Financial Intelligence Engine Started")
        self.MODULE_LIBRARY = {
            "remove_duplicates": {"id": "dp1", "label": "Remove Duplicates"},
            "impute": {"id": "dp2", "label": "Handle Missing Values"},
            "outlier": {"id": "dp3", "label": "Outlier Removal"},
            "polynomial": {"id": "dp5", "label": "Polynomial Features"},
            "log": {"id": "dp6", "label": "Log Transform"},
            "encode": {"id": "dp7", "label": "Encoding"},
            "scale": {"id": "dp8", "label": "Scaling"},
            "normalize": {"id": "dp9", "label": "Normalization"},
            "pca": {"id": "dp10", "label": "PCA"},
            "drop": {"id": "dp_drop", "label": "Drop Column"}
        }

    def get_dataset_profile(self, df: pd.DataFrame) -> str:
        col_stats = []
        df_clean = df.replace([r'^\s*$', r'^\?$', r'^NA$', r'^nan$'], np.nan, regex=True)
        for col in df_clean.columns:
            dtype, missing, unique = str(df_clean[col].dtype), int(df_clean[col].isnull().sum()), int(df_clean[col].nunique())
            status = f"[🚨 MISSING: {missing}]" if missing > 0 else "[COMPLETE]"
            
            # SKEW DETECTION
            skew_hint = ""
            if pd.api.types.is_numeric_dtype(df_clean[col]) and unique > 20:
                try:
                    s = df_clean[col].skew()
                    if abs(s) > 1.0: skew_hint = "[HIGH SKEW]"
                except: pass

            col_stats.append(f"VAR: '{col}' | Type: {dtype} {skew_hint} | {status} | Unique: {unique}")
        return "\n".join(col_stats)

    # PHASE 1: ASSESSMENT
    def generate_executive_summary(self, df):
        safe_log("\n--- Phase 1: Assessment ---")
        prompt = f"You are a Chief Risk Officer. Audit this finance dataset:\n{self.get_dataset_profile(df)}\nIdentify domain and hygiene risks. < 200 words."
        return ask_llm(prompt, temperature=0.3)

    # PHASE 2: TECHNICAL STRATEGY
    def generate_detailed_strategy(self, df, summary):
        safe_log("\n--- Phase 2: Technical Strategy ---")
        profile = self.get_dataset_profile(df)
        
        prompt = f"""
        You are a **Lead Financial Data Scientist**.
        Design a **Multi-Step Quantitative Pipeline**.

        CONTEXT:
        {summary}

        DATA PROFILE (SOURCE OF TRUTH):
        {profile}

        ==================================================
        DECISION TREE (APPLY IN ORDER):
        ==================================================

        1. **INTEGRITY CHECK (MISSING DATA)**:
           - IF [MISSING]: Start with `handle_missing_values` (Mean/Mode).
           - IF [COMPLETE]: Skip imputation.

        2. **DISTRIBUTION CHECK (NUMERIC ONLY)**:
           - IF [HIGH SKEW]: Add `log_transform` to normalize volatility (e.g. Income/Balance).
           - ELSE IF Continuous: Add `scaling` (Standard Scaler).

        3. **CATEGORICAL LOGIC**:
           - Nominal (Branch, Gender): `encoding` (One-Hot).
           - Ordinal (Rating AAA-D): `encoding` (Label).

        4. **EXCLUSION**:
           - High Cardinality IDs (TransactionID): `drop`.
           
        5. **FEATURE PROTECTION**:
           - NEVER drop 'Age', 'Balance', 'Salary', 'Investment', 'Gender'. These are critical.

        ==================================================
        OUTPUT FORMAT (Markdown):
        
        ### Variable Analysis
        
        **[Column Name]**
        - *Logic Reason*: [Financial justification]
        - *Action Sequence*: [Impute -> Log -> Scale / One-Hot / Drop]
        """
        return clean_strategy_text(ask_llm(prompt, temperature=0.2))

    # PHASE 3: JSON COMPILER & NORMALIZATION
    def _normalize_plan(self, data, df):
        normalized = {}
        all_cols = df.columns.tolist()
        PHRASE_MAP = {"impute": "impute", "scale": "scale", "encode": "encode", "log": "log", "drop": "drop"}
        
        # Handle list vs dict
        if isinstance(data, list):
            new_data = {}
            for item in data:
                if isinstance(item, dict):
                    for k in ['column', 'name', 'col']:
                        if k in item: new_data[item[k]] = item; break
            if new_data: data = new_data
            else:
                if len(data) == len(all_cols): data = dict(zip(all_cols, data))

        for col in all_cols:
            col_lower = col.lower()
            info = next((v for k, v in data.items() if k.lower() == col_lower), {})
            
            actions = info.get("actions", [])
            if isinstance(actions, str): actions = [actions]
            
            steps = []
            for act in actions:
                key = next((k for p, k in PHRASE_MAP.items() if p in str(act).lower()), None)
                if key:
                    mod = self.MODULE_LIBRARY[key]
                    steps.append({"action": key, "moduleId": mod["id"], "label": mod["label"], "params": "auto"})
            
            # --- INTELLIGENT FALLBACK (Feature Protection) ---
            if not steps or (len(steps) == 1 and steps[0]['action'] == 'drop' and col.lower() not in ['id', 'index', 'acc']):
                if pd.api.types.is_numeric_dtype(df[col]):
                    steps = [{"action": "scale", "moduleId": "dp8", "label": "Scaling", "params": "auto"}]
                    reason = f"Numerical financial feature '{col}' standardized for quantitative analysis."
                else:
                    steps = [{"action": "encode", "moduleId": "dp7", "label": "Encoding", "params": "auto"}]
                    reason = f"Categorical feature '{col}' encoded to preserve transactional characteristics."
            else:
                reason = info.get("reason", "Standard financial preprocessing.")

            normalized[col] = {"steps": steps, "reason": reason}
        return normalized

    def generate_json_plan(self, df, strategy):
        safe_log("\n--- Phase 3: JSON Compiler ---")
        prompt = f"""
        You are a JSON Compiler. Convert the strategy into strict JSON.
        
        STRATEGY: 
        {strategy}
        
        INSTRUCTIONS:
        1. Keys = Exact Column Names from {list(df.columns)}.
        2. Actions = List from ["impute", "scale", "encode", "drop", "log"].
        3. **Logic Reason**: Copy the financial rationale verbatim.
        4. **SEQUENCE**: If strategy says "Impute then Scale", output ["impute", "scale"].

        OUTPUT FORMAT:
        {{ "Balance": {{ "actions": ["impute", "log", "scale"], "reason": "Impute missing, log transform skew, scale." }} }}
        """
        raw = ask_llm_json(prompt)
        return self._normalize_plan(safe_parse_json(raw), df)

    def run(self, df):
        sum_text = self.generate_executive_summary(df)
        strat_text = self.generate_detailed_strategy(df, sum_text)
        return {"plan": self.generate_json_plan(df, strat_text), "summary": sum_text, "strategy": strat_text}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("file_path")
    args, _ = parser.parse_known_args()
    print("__JSON_RESULT_START__")
    print(json.dumps(FinancePlanGenerator().run(pd.read_csv(args.file_path))))
    print("__JSON_RESULT_END__")