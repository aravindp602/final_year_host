import pandas as pd
import json
import sys
import os
import argparse
import numpy as np
import re
import traceback
from typing import Dict, Any
from huggingface_hub import InferenceClient
from dotenv import load_dotenv

def force_utf8_streams():
    """Forces stdout/stderr to UTF-8 to prevent Windows crashes."""
    try:
        if sys.stdout.encoding.lower() != 'utf-8':
            sys.stdout.reconfigure(encoding='utf-8')
        if sys.stderr.encoding.lower() != 'utf-8':
            sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

force_utf8_streams()

def safe_log(message):
    """Safely prints logs, replacing crashing characters like smart quotes/dashes."""
    try:
        print(message, file=sys.stderr, flush=True)
    except UnicodeEncodeError:
        # Fallback: Convert to ASCII, replacing errors with '?'
        clean_msg = message.encode('ascii', 'replace').decode('ascii')
        print(clean_msg, file=sys.stderr, flush=True)

# ============================================================
# ENV & CONFIG
# ============================================================

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

HF_TOKEN = os.getenv("HF_TOKEN")
if not HF_TOKEN:
    safe_log("[Critical] HF_TOKEN not found in .env")
    # Don't crash immediately, let main block handle it cleanly

# --- MODEL CONFIGURATION ---
HF_MODEL_SUMMARY = "meta-llama/Llama-3.2-3B-Instruct" 
HF_MODEL_LOGIC = "meta-llama/Llama-3.1-8B-Instruct:novita"

try:
    client = InferenceClient(api_key=HF_TOKEN)
except:
    client = None

# ============================================================
# UTILITIES
# ============================================================

def clean_json_text(text: str) -> str:
    """Robust JSON extraction handling smart quotes and formatting errors."""
    if not text: return ""
    
    # [FIX] Replace Smart Quotes/Dashes that break JSON
    text = text.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'")
    text = text.replace('—', '-')
    
    text = re.sub(r'```json', '', text, flags=re.IGNORECASE)
    text = re.sub(r'```', '', text)
    # Remove C-style comments
    text = re.sub(r'//.*', '', text)
    # Fix trailing commas
    text = re.sub(r',(\s*[}\]])', r'\1', text)
    
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        return text[start : end + 1]
    return text.strip()

def ask_hf_llm(prompt: str, model: str, temperature: float = 0.1) -> str:
    if not client: return ""
    try:
        safe_log(f"   [Step] Requesting {model}...")
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
            safe_log("   [Warn] Model failed, switching fallback...")
            return ask_hf_llm(prompt, HF_MODEL_LOGIC, temperature)
        safe_log(f"   [Error] HF LLM Error: {e}")
        return ""

# ============================================================
# ENGINE
# ============================================================

class MedicalPlanGenerator:
    def __init__(self):
        safe_log("[Init] Initializing Clinical Engine...")
        
        self.MODULE_LIBRARY = {
            "remove_duplicates": {"id": "dp1", "label": "Remove Duplicates (D)"},
            "impute": {"id": "dp2", "label": "Handle Missing Values (D)"},
            "outlier": {"id": "dp3", "label": "Outlier Removal (D)"},
            "polynomial": {"id": "dp5", "label": "Polynomial Features (D)"},
            "log": {"id": "dp6", "label": "Log Transform (D)"},
            "encode": {"id": "dp7", "label": "Encoding (D)"},
            "scale": {"id": "dp8", "label": "Scaling (D)"},
            "normalize": {"id": "dp9", "label": "Normalization (D)"},
            "pca": {"id": "dp10", "label": "PCA (D)"},
            "drop": {"id": "dp_drop", "label": "Drop Column"}
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
                samples = list(df_clean[col].dropna().unique())[:5]

                missing_flag = f"[MISSING: {missing_count}]" if missing_count > 0 else "[COMPLETE]"
                
                skew_hint = ""
                if pd.api.types.is_numeric_dtype(df_clean[col]):
                    try:
                        skew = df_clean[col].skew()
                        if abs(skew) > 1.5: skew_hint = "(Skewed)"
                    except: pass

                col_stats.append(f"VAR: '{col}' | Type: {dtype} | Status: {missing_flag} {skew_hint} | Samples: {samples}")

            return "\n".join(col_stats)
        except Exception as e:
            safe_log(f"[Error] Profiling Failed: {e}")
            return "Dataset Profile Error"

    # ============================================================
    # PHASE 1: CLINICAL REPORT
    # ============================================================

    def generate_executive_summary(self, df: pd.DataFrame) -> str:
        safe_log("\n--- Phase 1: Clinical Assessment ---")
        profile = self.get_dataset_profile(df)

        prompt = f"""
SYSTEM ROLE:
You are the **Chief Medical Information Officer (CMIO)** at a leading research hospital.
Your task is to write a **Comprehensive Clinical Data Assessment**.

DATA PROFILE:
{profile}

INSTRUCTIONS:
Write a detailed report (minimum 300 words) covering:
1.  **Domain & Specialty**: Explicitly identify the medical field (e.g., Oncology, Cardiology) and the likely source of data (EHR, Clinical Trial, Wearables).
2.  **Pathophysiological Context**: Analyze the key variables. Explain *what* they measure biologically (e.g., "Creatinine is a byproduct of muscle metabolism used to assess renal filtration").
3.  **Cohort Characteristics**: Describe the patient population based on the data samples (e.g., age range, gender distribution).
4.  **Data Integrity & Risk**: Discuss the clinical impact of missing or skewed data on potential diagnosis models.

TONE: Professional, Academic, and Medically Precise.
"""
        return ask_hf_llm(prompt, HF_MODEL_SUMMARY, temperature=0.3)

    # ============================================================
    # PHASE 2: BIOSTATISTICAL BLUEPRINT
    # ============================================================

    def generate_detailed_strategy(self, df: pd.DataFrame, executive_summary: str) -> str:
        safe_log("\n--- Phase 2: Technical Strategy ---")
        profile = self.get_dataset_profile(df)

        prompt = f"""
SYSTEM ROLE:
You are a **Senior Biostatistician**. Create a **Technical Preprocessing Blueprint** for Machine Learning.
Focus on **Biostatistical Reasoning**—why is a specific transformation mathematically or biologically necessary?

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

### BIOSTATISTICAL LOGIC (Apply Strictly):

1.  **VITAL SIGNS (Continuous)**:
    * *Action*: **Scaling (dp8)**.
    * *Medical Reason*: "Standardization (Z-score) is required because physiological variables (e.g., Age in years vs BP in mmHg) exist on vastly different scales, which biases distance-based algorithms."
    * *If Skewed*: **Log Transform (dp6)** then Scale. (Reason: "Normalizing the right-skewed distribution typical of serum biomarkers").
    * *If Missing*: **Impute (dp2)**. (Reason: "Multivariate Iterative Imputation (MICE) is preferred to preserve physiological correlations, such as the relationship between BMI and Blood Pressure").

2.  **CATEGORICAL FACTORS (Nominal)**:
    * *Action*: **Encoding (dp7)** (One-Hot).
    * *Medical Reason*: "Variables like Gender or Smoking Status lack intrinsic biological rank; One-Hot Encoding prevents the model from assuming a false ordinal relationship."

3.  **DISEASE STAGES (Ordinal)**:
    * *Action*: **Encoding (dp7)** (Label Encode).
    * *Medical Reason*: "Preserving the inherent prognostic rank of disease progression (e.g., Stage I < Stage II) is critical for accurate severity modeling."

4.  **ADMINISTRATIVE**:
    * *Action*: **Drop Column**.
    * *Medical Reason*: "Patient identifiers have no pathophysiological relevance and pose a privacy risk."

OUTPUT FORMAT (Markdown):
For each column, list the **Steps** and the **Biostatistical Reasoning**.
"""
        return ask_hf_llm(prompt, HF_MODEL_LOGIC, temperature=0.1)

    # ============================================================
    # PHASE 3: JSON MAPPING & SANITIZATION
    # ============================================================

    def _robust_json_generation(self, prompt: str) -> Dict[str, Any]:
        for attempt in range(3):
            if attempt > 0: safe_log(f"   [Retry] JSON Parse attempt {attempt+1}...")
            raw = ask_hf_llm(prompt, HF_MODEL_LOGIC, temperature=0.1)
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
            # Fix single string issue
            if isinstance(raw_actions_list, str): raw_actions_list = [raw_actions_list]
            
            # Handle comma-separated strings inside list
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
                    reason_txt = str(info.get("reason", "")).lower()
                    if "label" in act_str or "ordinal" in reason_txt or "rank" in reason_txt:
                        final_params = "label_encoder"
                    else:
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
                    "reason": info.get("reason", "Standard preprocessing sequence.")
                }
        return normalized

    def _sanitize_plan_logic(self, df: pd.DataFrame, plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        HARD VALIDATION: Remove 'impute' ONLY if column has 0 missing values AND it wasn't requested.
        However, if the plan explicitly suggests imputation for logic reasons (e.g. outlier handling), 
        we should be careful. 
        [UPDATE]: Loosened strictness. If LLM says Impute, we allow it, as it might be a safety measure 
        for future data or outliers treated as missing.
        """
        sanitized_plan = {}
        for col, details in plan.items():
            if col not in df.columns: continue
            sanitized_plan[col] = details
        return sanitized_plan

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
3. **CRITICAL**: Copy the full "Biostatistical Reasoning" from the strategy into the 'reason' field verbatim.

OUTPUT EXAMPLE:
{{
  "Creatinine": {{
    "actions": ["impute", "log", "scale"],
    "reason": "Iterative imputation preserves correlations. Log transform normalizes skewed biological markers, followed by standardization."
  }}
}}
"""
        data = self._robust_json_generation(prompt)
        normalized = self._normalize_plan(data)
        final_plan = self._sanitize_plan_logic(df, normalized)
        return final_plan

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

        generator = MedicalPlanGenerator()

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
        # Traceback is helpful for debugging 500 errors
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)