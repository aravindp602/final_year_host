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
from typing import Dict, Any
from dotenv import load_dotenv

# ============================================================
# UTF-8 SAFETY (Windows Compatibility)
# ============================================================
def force_utf8_streams():
    try:
        if sys.stdout.encoding.lower() != 'utf-8':
            sys.stdout.reconfigure(encoding='utf-8')
        if sys.stderr.encoding.lower() != 'utf-8':
            sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

force_utf8_streams()

def safe_log(message):
    try:
        print(message, file=sys.stderr, flush=True)
    except UnicodeEncodeError:
        clean_msg = message.encode('ascii', 'replace').decode('ascii')
        print(clean_msg, file=sys.stderr, flush=True)

# ============================================================
# CONFIGURATION
# ============================================================

load_dotenv()
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2" 

# ============================================================
# LLM API (OLLAMA SPECIFIC)
# ============================================================

def ask_llm(prompt: str, temperature: float = 0.2) -> str:
    try:
        safe_log(f"   [LLM] Requesting {OLLAMA_MODEL}...")
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "temperature": temperature,
                "stream": False
            },
            timeout=300
        )
        if response.status_code != 200:
            return ""
        return response.json().get("response", "").strip()
    except Exception as e:
        safe_log(f"   [Error] Connection failed: {e}")
        return ""

def ask_llm_json(prompt: str, temperature: float = 0.1) -> str:
    """Forces Ollama to output valid JSON"""
    try:
        safe_log(f"   [LLM] Requesting JSON...")
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "format": "json", 
                "temperature": temperature,
                "stream": False
            },
            timeout=300
        )
        if response.status_code != 200: return "{}"
        return response.json().get("response", "{}")
    except Exception:
        return "{}"

# ============================================================
# PARSING UTILITIES
# ============================================================

def clean_json_text(text: str) -> str:
    if not text: return "{}"
    text = re.sub(r'```json', '', text, flags=re.IGNORECASE)
    text = re.sub(r'```', '', text)
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        return text[start : end + 1]
    return text

def safe_parse_json(text: str) -> Dict:
    cleaned = clean_json_text(text)
    if not cleaned: return {}
    try: return json.loads(cleaned)
    except: pass
    try: return ast.literal_eval(cleaned)
    except: pass
    return {}

def clean_strategy_text(text: str) -> str:
    if not text: return ""
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text) 
    text = re.sub(r'([^*])\*([^*]+)\*', r'\1\2', text)
    return text.replace("`", "")

# ============================================================
# CORE ENGINE
# ============================================================

class MedicalPlanGenerator:

    def __init__(self):
        safe_log("[Init] Clinical Engine Started (Ollama)")
        
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

    # ------------------------------------------------------------
    # 1. SMART PROFILING
    # ------------------------------------------------------------
    def get_dataset_profile(self, df: pd.DataFrame) -> str:
        col_stats = []
        df_clean = df.replace([r'^\s*$', r'^\?$', r'^NA$', r'^nan$', r'^null$', r'^None$'], np.nan, regex=True)

        for col in df_clean.columns:
            dtype = str(df_clean[col].dtype)
            missing = int(df_clean[col].isnull().sum())
            unique = int(df_clean[col].nunique())
            
            if unique < 15:
                samples = list(df_clean[col].dropna().unique())
            else:
                samples = list(df_clean[col].dropna().unique()[:5])

            missing_flag = f"[🚨 ALERT: {missing} MISSING]" if missing > 0 else "[Data Complete]"
            
            skew_hint = ""
            if 'float' in dtype or 'int' in dtype:
                if unique > 20: 
                    try:
                        s = df_clean[col].skew()
                        if abs(s) > 1: skew_hint = "[HIGH SKEW]"
                    except: pass

            col_stats.append(f"VAR: '{col}' | Type: {dtype} {skew_hint} | {missing_flag} | Samples: {samples}")

        return "\n".join(col_stats)

    # ------------------------------------------------------------
    # 2. PHASE 1: CLINICAL REPORT
    # ------------------------------------------------------------
    def generate_executive_summary(self, df):
        safe_log("\n--- Phase 1: Clinical Assessment ---")
        profile = self.get_dataset_profile(df)

        prompt = f"""
        You are the **Chief Medical Information Officer (CMIO)**.
        Write a concise **Clinical Data Assessment** (250 words).

        DATASET PROFILE:
        {profile}

        INSTRUCTIONS:
        1. **Domain**: Identify the medical specialty (e.g. Oncology, Cardiology).
        2. **Hygiene**: Note missing vital signs or demographics.
        3. **Suitability**: Is this data fit for predictive modeling?

        Tone: Professional, Clinical, Concise.
        """
        return ask_llm(prompt, temperature=0.3) or "Summary generation failed."

    # ------------------------------------------------------------
    # 3. PHASE 2: DETAILED STRATEGY (Deep Medical Reasoning)
    # ------------------------------------------------------------
    def generate_detailed_strategy(self, df, summary):
        safe_log("\n--- Phase 2: Pathophysiological Strategy ---")
        profile = self.get_dataset_profile(df)

        prompt = f"""
        You are a **Clinical Biostatistician**.
        Develop a preprocessing plan that respects **Pathophysiology** and **Biomedical Relevance**.

        ==================================================
        DATA PROFILE:
        {profile}

        ==================================================
        CRITICAL INSTRUCTION FOR REASONING:
        Do NOT say "Because it is numeric" or "Standard preprocessing".
        You MUST explain the **MEDICAL REASON** for the action.

        EXAMPLES OF GOOD REASONING:
        - "Impute Glucose with mean to preserve the population distribution of metabolic markers."
        - "Log transform CRP because inflammatory markers are typically right-skewed."
        - "Scale Age to normalize demographic variance without distorting risk factors."
        - "One-Hot Encode 'Smoker' as it is a critical binary risk factor for cardiovascular outcomes."

        ==================================================
        LOGIC RULES:
        1. **Missing Data**: 
           - If [🚨 ALERT]: Must use `handle_missing_values`.
           - Reason: "Preserve sample size" or "Maintain clinical distribution".
           
        2. **Continuous Vitals/Labs**:
           - Action: `scaling` (Standard).
           - Reason: "Standardize physiological range."

        3. **Nominal History** (Gender, Disease):
           - Action: `encoding` (One-Hot).
           - Reason: "Nominal risk factor."

        4. **Skewed Data** (Costs, LoS):
           - Action: `log_transform`.

        FORMAT:
        [Column Name]
          * Sequence: [Action 1] -> [Action 2]
          * Clinical Rationale: [Deep medical explanation]
        """
        return ask_llm(prompt, temperature=0.2) or "Strategy generation failed."

    # ------------------------------------------------------------
    # 4. PHASE 3: JSON COMPILER (Reasoning Extraction)
    # ------------------------------------------------------------
    def _normalize_plan(self, data, df):
        normalized = {}
        all_cols = df.columns.tolist()

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

        # Keyword Map
        PHRASE_MAP = {
            "impute": "impute", "missing": "impute",
            "scale": "scale", "standard": "scale",
            "one_hot": "encode", "label": "encode", "encode": "encode",
            "log": "log", "skew": "log",
            "outlier": "outlier",
            "drop": "drop", "remove": "drop",
            "duplicate": "remove_duplicates",
            "poly": "polynomial",
            "pca": "pca",
            "normal": "normalize"
        }

        for col, info in data.items():
            if col not in all_cols: continue 

            actions = info.get("actions", [])
            if isinstance(actions, str): actions = [actions]
            
            steps = []
            for act in actions:
                a = str(act).lower()
                key = None
                
                for phrase, k in PHRASE_MAP.items():
                    if phrase in a:
                        key = k
                        break
                
                if key and key in self.MODULE_LIBRARY:
                    mod = self.MODULE_LIBRARY[key]
                    
                    params = "auto"
                    if key == "encode":
                         reason = str(info.get("reason", "")).lower()
                         if "label" in a or "ordinal" in reason or "rank" in reason: params = "label"
                         else: params = "one_hot"
                    elif key == "impute":
                         params = "mean"

                    steps.append({
                        "action": key,
                        "moduleId": mod["id"],
                        "label": mod["label"],
                        "params": params
                    })
            
            # EXTRACT RICH REASONING
            clinical_reason = info.get("reason", "Standard biomedical preprocessing.")
            
            # Fallback if reasoning is poor
            if len(clinical_reason) < 15:
                if "scale" in str(steps): clinical_reason = "Normalize physiological variance."
                elif "encode" in str(steps): clinical_reason = "Categorical encoding for risk factor analysis."

            if steps:
                normalized[col] = {
                    "steps": steps,
                    "reason": clinical_reason
                }
        
        # 5. SAFETY NET: Handle Missing Columns
        for col in all_cols:
            if col not in normalized:
                # Basic Fallback
                dtype = str(df[col].dtype)
                missing = df[col].isnull().sum() > 0
                auto_steps = []
                auto_reason = "Auto-generated default."

                if missing: 
                    auto_steps.append({"action": "impute", "moduleId": "dp2", "label": "Handle Missing Values", "params": "mean"})
                    auto_reason = "Impute missing values to maintain data integrity."
                
                if 'int' in dtype or 'float' in dtype:
                    auto_steps.append({"action": "scale", "moduleId": "dp8", "label": "Scaling", "params": "standard"})
                    if "Impute" not in auto_reason: auto_reason = "Standardize continuous variable."
                else:
                    auto_steps.append({"action": "encode", "moduleId": "dp7", "label": "Encoding", "params": "one_hot"})
                    if "Impute" not in auto_reason: auto_reason = "Encode categorical feature."

                normalized[col] = {"steps": auto_steps, "reason": auto_reason}

        return normalized

    def generate_json_plan(self, df, strategy):
        safe_log("\n--- Phase 3: JSON Compiler ---")
        profile = self.get_dataset_profile(df)
        cols_list = list(df.columns)

        prompt = f"""
        You are a strict JSON Compiler. 

        DATA PROFILE:
        {profile}

        STRATEGY TEXT:
        {strategy}

        INSTRUCTIONS:
        1. **Map Actions**: Convert strategy text to JSON actions list.
        2. **EXTRACT REASONING**:
           - COPY the specific "Clinical Rationale" from the strategy text into the JSON `reason` field. 
           - **DO NOT** use generic phrases.
           - **REQUIRED**: Use specific text like "BMI is a critical cardiac risk factor."

        3. **VALIDATION**:
           - Keys must match columns: {cols_list}

        OUTPUT FORMAT (JSON ONLY):
        {{
          "BMI": {{
            "actions": ["impute", "scale"],
            "reason": "Imputing missing BMI to preserve sample size, followed by scaling to normalize obesity risk factors."
          }}
        }}
        """
        
        data = {}
        # Using ask_llm_json for reliability
        for i in range(3):
            raw = ask_llm_json(prompt, temperature=0.1)
            parsed = safe_parse_json(raw)
            if parsed and (isinstance(parsed, dict) or isinstance(parsed, list)):
                data = parsed
                break
            safe_log(f"   [Retry] JSON Parse failed {i+1}/3")
            
        return self._normalize_plan(data, df)

    # ------------------------------------------------------------
    # RUN
    # ------------------------------------------------------------
    def run(self, df):
        summary = self.generate_executive_summary(df)
        strategy = self.generate_detailed_strategy(df, summary)
        plan = self.generate_json_plan(df, strategy)
        return { "plan": plan, "summary": summary, "strategy": strategy }

# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("file_path", help="Path to CSV")
    args, _ = parser.parse_known_args()

    try:
        try: df = pd.read_csv(args.file_path, sep=None, engine='python')
        except: df = pd.read_csv(args.file_path)

        generator = MedicalPlanGenerator()
        result = generator.run(df)

        print("__JSON_RESULT_START__")
        print(json.dumps(result))
        print("__JSON_RESULT_END__")

    except Exception as e:
        safe_log(f"[Error] Execution Failed: {e}")
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)