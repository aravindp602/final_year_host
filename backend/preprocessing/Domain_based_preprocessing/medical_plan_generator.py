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
# Summary: Creative model for long clinical reports
HF_MODEL_SUMMARY = "meta-llama/Llama-3.2-3B-Instruct" 
# Logic: Smarter model for technical reasoning and JSON mapping
HF_MODEL_LOGIC = "meta-llama/Llama-3.1-8B-Instruct:novita"

client = InferenceClient(api_key=HF_TOKEN)

# ============================================================
# UTILITIES
# ============================================================

def clean_json_text(text: str) -> str:
    """Robust JSON extraction."""
    if not text: return ""
    text = re.sub(r'```json', '', text, flags=re.IGNORECASE)
    text = re.sub(r'```', '', text)
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        return text[start : end + 1]
    return text

def ask_hf_llm(prompt: str, model: str, temperature: float = 0.1) -> str:
    try:
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
    def __init__(self):
        sys.stdout.reconfigure(encoding='utf-8')
        print(f"🚀 Initializing Clinical Engine...", file=sys.stderr, flush=True)
        
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
        col_stats = []
        df_clean = df.replace([r'^\s*$', r'^\?$', r'^NA$', r'^nan$', r'^null$', r'^None$'], np.nan, regex=True)

        for col in df_clean.columns:
            dtype = str(df_clean[col].dtype)
            missing_count = int(df_clean[col].isnull().sum())
            unique = int(df_clean[col].nunique())
            
            if unique < 15:
                samples = list(df_clean[col].dropna().unique())
            else:
                samples = list(df_clean[col].dropna().unique()[:5])

            missing_flag = f"[🚨 ALERT: {missing_count} MISSING]" if missing_count > 0 else "[Complete]"

            skew_hint = ""
            if pd.api.types.is_numeric_dtype(df_clean[col]):
                try:
                    skew = df_clean[col].skew()
                    if abs(skew) > 1.5: skew_hint = "(Highly Skewed)"
                except: pass

            stat_str = (
                f"VAR: '{col}' | Type: {dtype} {skew_hint} | {missing_flag} | Samples: {samples}"
            )
            col_stats.append(stat_str)

        return "\n".join(col_stats)

    # ============================================================
    # PHASE 1: COMPREHENSIVE CLINICAL REPORT
    # ============================================================

    def generate_executive_summary(self, df: pd.DataFrame) -> str:
        print("\n--- Phase 1: Clinical Assessment ---", file=sys.stderr, flush=True)
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
        print("\n--- Phase 2: Technical Strategy ---", file=sys.stderr, flush=True)
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
        response = ask_hf_llm(prompt, HF_MODEL_LOGIC, temperature=0.1)
        if not response or len(response) < 50: return "## Fallback Strategy"
        return response

    # ============================================================
    # PHASE 3: JSON MAPPING & SANITIZATION
    # ============================================================

    def _robust_json_generation(self, prompt: str) -> Dict[str, Any]:
        for attempt in range(3):
            if attempt > 0: print(f"   ⚠️ JSON Parse failed. Retrying...", file=sys.stderr)
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
            if not raw_actions_list and isinstance(info.get("action"), str):
                 raw_actions_list = [x.strip() for x in info.get("action").split(',')]

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
        HARD VALIDATION: Remove 'impute' if column has 0 missing values.
        """
        missing_series = df.isnull().sum()
        cols_with_missing = missing_series[missing_series > 0].index.tolist()

        sanitized_plan = {}
        for col, details in plan.items():
            if col not in df.columns: continue
            
            original_steps = details.get("steps", [])
            cleaned_steps = []
            
            for step in original_steps:
                if step['action'] == 'impute':
                    if col in cols_with_missing:
                        cleaned_steps.append(step)
                    else:
                        # Skip adding imputation if no missing data
                        pass 
                else:
                    cleaned_steps.append(step)
            
            if cleaned_steps:
                sanitized_plan[col] = {
                    "steps": cleaned_steps,
                    "reason": details.get("reason", "")
                }
        return sanitized_plan

    def generate_json_plan(self, df: pd.DataFrame, detailed_strategy: str) -> Dict[str, Any]:
        print("\n--- Phase 3: JSON Configuration ---", file=sys.stderr, flush=True)
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
        print(f"❌ Execution Failed: {e}", file=sys.stderr)