import pandas as pd
import json
import sys
import os
import argparse
import numpy as np
import re
from typing import Dict, Any
from huggingface_hub import InferenceClient
from dotenv import load_dotenv

# ============================================================
# ENV & CONFIG
# ============================================================

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

HF_TOKEN = os.getenv("HF_TOKEN")
if not HF_TOKEN:
    raise ValueError("❌ HF_TOKEN not found in .env")

# --- MODEL CONFIGURATION ---
# 1. Report/Summary Model (Lighter, Creative)
HF_MODEL_SUMMARY = "meta-llama/Llama-3.2-3B-Instruct" 

# 2. Logic/JSON Model (Strict, Smarter, Clinical Logic)
HF_MODEL_LOGIC = "meta-llama/Llama-3.1-8B-Instruct:novita"

client = InferenceClient(api_key=HF_TOKEN)

# ============================================================
# UTILITIES
# ============================================================

def auto_repair_json(text: str) -> str:
    if not text: return text
    # Fix unclosed braces
    open_braces = text.count("{")
    close_braces = text.count("}")
    if close_braces < open_braces: text += "}" * (open_braces - close_braces)
    # Fix trailing commas
    text = re.sub(r',\s*}', '}', text)
    return text

def extract_json_block(text: str) -> str:
    """
    Robust extraction that stops at the matching closing brace 
    to prevent 'Extra data' errors from multiple JSON objects.
    """
    if not text: return ""
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    
    start = text.find('{')
    if start == -1: return ""
    
    # Smart Brace Counting
    count = 0
    for i, char in enumerate(text[start:]):
        if char == '{':
            count += 1
        elif char == '}':
            count -= 1
            if count == 0:
                return text[start : start + i + 1]
    return text[start:]

def ask_hf_llm(prompt: str, model: str, temperature: float = 0.1) -> str:
    try:
        # Visual log without progress dots
        print(f"   ⏳ Requesting {model}...", file=sys.stderr, flush=True)
        
        stream = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=4096,
            stream=True,
        )
        output = ""
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta:
                content = chunk.choices[0].delta.content
                if content: output += content
        return output
    except Exception as e:
        if model != HF_MODEL_LOGIC:
            print(f"⚠️ Model {model} failed, switching to fallback...", file=sys.stderr)
            return ask_hf_llm(prompt, HF_MODEL_LOGIC, temperature)
        print(f"❌ HF LLM Error: {e}", file=sys.stderr)
        return ""

# ============================================================
# ENGINE
# ============================================================

class MedicalPlanGenerator:
    def __init__(self, target_col: str = "Level"):
        self.target_col = target_col
        sys.stdout.reconfigure(encoding='utf-8')
        print(f"🚀 Initializing Medical Engine...", file=sys.stderr, flush=True)

    # ---------------- ROBUST DATA PROFILING ----------------

    def get_dataset_profile(self, df: pd.DataFrame) -> str:
        col_stats = []
        
        # AGGRESSIVE CLEANING: Replace diverse null types with np.nan
        df_clean = df.replace([r'^\s*$', r'^\?$', r'^NA$', r'^nan$', r'^null$', r'^None$'], np.nan, regex=True)

        for col in df_clean.columns:
            dtype = str(df_clean[col].dtype)
            
            # Count Missing
            missing_count = int(df_clean[col].isnull().sum())
            total_rows = len(df_clean)
            missing_pct = (missing_count / total_rows) * 100
            
            unique = int(df_clean[col].nunique())
            
            # Get samples
            if unique < 15:
                samples = list(df_clean[col].dropna().unique())
            else:
                samples = list(df_clean[col].dropna().unique()[:5])

            # CRITICAL FLAG for LLM
            missing_flag = ""
            if missing_count > 0:
                missing_flag = f"[🚨 CLINICAL ALERT: {missing_count} MISSING VALUES ({missing_pct:.1f}%)]"
            else:
                missing_flag = "[Data Complete]"

            # Detect Potential Ordinality in Strings
            ordinal_hint = ""
            if dtype == 'object' and any(x in str(samples).lower() for x in ['low', 'medium', 'high', 'stage', 'grade']):
                ordinal_hint = "(Potential Ordinal/Ranked Data)"

            stat_str = (
                f"VAR: '{col}'\n"
                f"   - Type: {dtype} {ordinal_hint}\n"
                f"   - {missing_flag}\n"
                f"   - Distinct Count: {unique}\n"
                f"   - Samples: {samples}\n"
            )
            col_stats.append(stat_str)

        return "\n".join(col_stats)

    # ============================================================
    # PHASE 1: CLINICAL REPORT (Summary)
    # ============================================================

    def generate_executive_summary(self, df: pd.DataFrame) -> str:
        print("\n--- Phase 1: Clinical Executive Summary ---", file=sys.stderr, flush=True)
        profile = self.get_dataset_profile(df)

        prompt = f"""
SYSTEM ROLE:
You are the **Chief Medical Information Officer (CMIO)** at a top research hospital.
You are evaluating a dataset for a Clinical AI Model.

==================================================
DATASET AUTOPSY:
{profile}

TARGET VARIABLE: '{self.target_col}'

==================================================
INSTRUCTIONS:
Write a **Clinical Data Assessment** (Markdown).

1. **Domain Identification**: Based on the column names (e.g., 'TNM', 'Creatinine', 'ICU_Stay'), identify the medical specialty (Oncology, Cardiology, Epidemiology, etc.).
2. **Clinical Feasibility**: Is the target variable '{self.target_col}' a valid clinical outcome (e.g., Diagnosis, Mortality, Severity)?
3. **Data Hygiene Alert**: Summarize the "🚨 CLINICAL ALERT" tags from the profile. Are the missing values in critical columns (like Vital Signs) or administrative columns?
4. **Privacy Check**: Note if any columns look like PII (Names, IDs) that must be dropped.

Tone: Professional, Medically Accurate, Concise.
"""
        return ask_hf_llm(prompt, HF_MODEL_SUMMARY, temperature=0.2)

    # ============================================================
    # PHASE 2: DETAILED STRATEGY (The Advanced Clinical Logic)
    # ============================================================

    def generate_detailed_strategy(self, df: pd.DataFrame, executive_summary: str) -> str:
        print("\n--- Phase 2: Detailed Clinical Blueprint ---", file=sys.stderr, flush=True)
        profile = self.get_dataset_profile(df)

        prompt = f"""
SYSTEM ROLE:
You are a **Lead Clinical Data Scientist** specializing in Electronic Health Records (EHR).
Develop a **Domain-Specific Preprocessing Strategy**.

==================================================
EXECUTIVE CONTEXT:
{executive_summary}

DATA PROFILE:
{profile}

==================================================
TASK:
Analyze EACH variable and assign a processing strategy based on its **Medical Archetype**.

### 1. GUIDELINES FOR LOGIC:

* **VITAL SIGNS / LABS (Continuous Numeric)**:
    * *Examples*: Blood Pressure, Glucose, Age, BMI, Cholesterol.
    * *Standard Action*: **Standard Scaling** (Z-score normalization) to treat outliers relative to population norms.
    * *Missing Logic*: If missing, **Impute with Mean**. Vitals typically follow a normal distribution.

* **RISK FACTORS / HISTORY (Nominal Categorical)**:
    * *Examples*: Smoking Status, Gender, Race, History of Diabetes.
    * *Standard Action*: **One-Hot Encoding**.
    * *Missing Logic*: **Impute with Mode** (Most frequent) or create 'Unknown' category.

* **DISEASE GRADING (Ordinal Categorical)**:
    * *Examples*: Tumor Stages (I, II, III), Severity (Low, Medium, High).
    * *Standard Action*: **Label Encoding**. 
    * *Critical Rule*: **DO NOT** One-Hot Encode these. You must preserve the rank order (Stage IV > Stage I).

* **ADMINISTRATIVE / IDS**:
    * *Examples*: PatientID, Date of Admission.
    * *Action*: **Drop**.

### 2. REQUIRED OUTPUT FORMAT (Markdown):

**Variable Analysis:**

* **[Column Name]**
    * *Clinical Relevance*: [Why is this medically important?]
    * *DataType*: [Nominal / Ordinal / Continuous]
    * *Missing Status*: [Has Missing / Complete]
    * *Primary Action*: [**Impute** / Scale / One-Hot / Label / Drop]
    * *Reasoning*: [Detailed explanation. E.g., "Imputing BMI with mean to preserve distribution," or "Label encoding Stage to maintain severity rank."]

**Summary of Exclusions:**
* List columns to be dropped and why.
"""
        response = ask_hf_llm(prompt, HF_MODEL_LOGIC, temperature=0.1)
        
        # FAILSAFE
        if not response or len(response) < 50:
            print("⚠️ Phase 2 response empty. Generating fallback...", file=sys.stderr)
            return "## Clinical Preprocessing Blueprint (Fallback)\nModel failed to generate detailed strategy."
        return response

    # ============================================================
    # PHASE 3: JSON MAPPING (Strict Configuration)
    # ============================================================

    def _robust_json_generation(self, prompt: str, df_cols) -> Dict[str, Any]:
        for attempt in range(3):
            if attempt > 0:
                 print(f"   ⚠️ JSON Parse failed. Retrying (Attempt {attempt+1}/3)...", file=sys.stderr)
            
            # Attempt 0: Strict. Attempt 1: Looser. Attempt 2: Last resort.
            temp = 0.1 if attempt == 0 else 0.3
            raw = ask_hf_llm(prompt, HF_MODEL_LOGIC, temperature=temp)
            clean = extract_json_block(raw)
            repaired = auto_repair_json(clean)
            try:
                data = json.loads(repaired)
                if len(data.keys()) > 0: 
                     return data
            except Exception as e:
                print(f"   Debug: JSON Error on attempt {attempt+1}: {e}", file=sys.stderr)
        return {}

    def _normalize_plan(self, data: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {}
        
        # Expanded Mapping for Medical Terms
        ACTION_MAP = {
            "standard scaling": "scale", "standard_scaling": "scale", "scale": "scale", "scaling": "scale", "normalize": "scale",
            "impute": "impute", "imputation": "impute", "mean": "impute", "median": "impute", "mode": "impute",
            "drop": "drop", "remove": "drop", "delete": "drop",
            "one_hot": "one_hot_encode", "one_hot_encode": "one_hot_encode", "dummy": "one_hot_encode",
            "label_encode": "label_encode", "label_encoding": "label_encode", "ordinal": "label_encode"
        }

        for col, info in data.items():
            if not isinstance(info, dict): continue
            
            # Clean the action string
            raw_action = str(info.get("action", "drop")).lower()
            clean_str = re.sub(r'[^\w\s]', '', raw_action).strip() # Remove punctuation
            clean_str = re.sub(r'\s+', ' ', clean_str) # Collapse spaces

            final_action = None
            if clean_str in ACTION_MAP:
                final_action = ACTION_MAP[clean_str]
            
            # Fuzzy match
            if not final_action:
                if "impute" in clean_str or "missing" in clean_str: final_action = "impute"
                elif "scale" in clean_str or "standard" in clean_str: final_action = "scale"
                elif "one_hot" in clean_str: final_action = "one_hot_encode"
                elif "label" in clean_str: final_action = "label_encode"
                else: final_action = "drop"

            normalized[col] = {
                "action": final_action,
                "params": info.get("params", "null"),
                "reason": info.get("reason", "Standard clinical preprocessing")
            }
        return normalized

    def generate_json_plan(self, df: pd.DataFrame, detailed_strategy: str) -> Dict[str, Any]:
        print("\n--- Phase 3: JSON Configuration ---", file=sys.stderr, flush=True)
        profile = self.get_dataset_profile(df)

        prompt = f"""
SYSTEM ROLE:
You are a **Strict MLOps Configuration Engine**. 
Convert the provided Clinical Strategy into a strict JSON configuration.

==================================================
DATASET PROFILE (CHECK FLAGS):
{profile}

==================================================
CLINICAL STRATEGY:
{detailed_strategy}

==================================================
RULES FOR JSON MAPPING:

1. **MISSING DATA PRIORITY (CRITICAL)**:
   - Check the PROFILE above. If a column has "🚨 CLINICAL ALERT", the Action **MUST** be "impute".
   - IGNORE other actions (like scaling) for now. If it's missing, we MUST impute first.

2. **IF NO MISSING DATA**:
   - **Nominal** (Gender, Smoker) -> "one_hot_encode"
   - **Ordinal** (Stage I/II) -> "label_encode"
   - **Numeric** (Age, BP) -> "scale"
   - **ID/Date** -> "drop"

3. **PARAMS**:
   - For Impute: "mean" (numeric), "mode" (categorical).
   - For Scale: "standard_scaler".

OUTPUT FORMAT (Raw JSON only):
{{
  "Creatinine_Level": {{
    "action": "impute",
    "params": "mean",
    "reason": "Missing values detected (12%). Imputing with mean to preserve renal function distribution."
  }},
  "TNM_Stage": {{
    "action": "label_encode",
    "params": "ordinal",
    "reason": "Preserving rank order of cancer progression."
  }}
}}
"""
        data = self._robust_json_generation(prompt, df.columns)
        return self._normalize_plan(data)

    # ============================================================
    # MAIN EXECUTION FLOW
    # ============================================================

    def run(self, df: pd.DataFrame):
        summary = self.generate_executive_summary(df)
        strategy = self.generate_detailed_strategy(df, summary)
        plan = self.generate_json_plan(df, strategy)
        
        return {
            "plan": plan,
            "summary": summary,
            "strategy": strategy
        }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("file_path", help="Path to CSV")
    parser.add_argument("--regenerate", help="Report text", default=None)
    args = parser.parse_args()

    try:
        try:
            # Try efficient engine first
            raw_df = pd.read_csv(args.file_path, sep=None, engine='python')
        except:
            raw_df = pd.read_csv(args.file_path)

        generator = MedicalPlanGenerator()

        if args.regenerate:
            # REGENERATION FLOW (User edits the text, we rebuild JSON)
            plan = generator.generate_json_plan(raw_df, args.regenerate)
            result = { "plan": plan }
            print("__JSON_RESULT_START__")
            print(json.dumps(result))
            print("__JSON_RESULT_END__")
        else:
            # INITIAL FLOW
            result = generator.run(raw_df)
            print("__JSON_RESULT_START__")
            print(json.dumps(result))
            print("__JSON_RESULT_END__")

    except Exception as e:
        print(f"❌ Execution Failed: {e}", file=sys.stderr)