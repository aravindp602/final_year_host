import pandas as pd
import json
import sys
import os
import argparse
from typing import Dict, Any
from huggingface_hub import InferenceClient
from dotenv import load_dotenv

# ============================================================
# ENV
# ============================================================

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

HF_TOKEN = os.getenv("HF_TOKEN")

if not HF_TOKEN:
    raise ValueError("❌ HF_TOKEN not found in .env")

# ============================================================
# MODEL CONFIG
# ============================================================

HF_MODEL = "meta-llama/Llama-3.1-8B-Instruct:novita"
client = InferenceClient(api_key=HF_TOKEN)

# ============================================================
# JSON SAFETY UTILITIES
# ============================================================

def auto_repair_json(text: str) -> str:
    if not text:
        return text

    open_braces = text.count("{")
    close_braces = text.count("}")
    if close_braces < open_braces:
        text += "}" * (open_braces - close_braces)

    open_brackets = text.count("[")
    close_brackets = text.count("]")
    if close_brackets < open_brackets:
        text += "]" * (open_brackets - close_brackets)

    return text


def extract_json_block(text: str) -> str:
    if not text:
        return ""

    clean = text.replace("```json", "").replace("```", "").strip()

    if "{" in clean and "}" in clean:
        start = clean.find("{")
        end = clean.rfind("}") + 1
        clean = clean[start:end]

    return clean

# ============================================================
# HF CALL
# ============================================================

def ask_hf_llm(prompt: str) -> str:
    try:
        stream = client.chat.completions.create(
            model=HF_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.05,
            max_tokens=4096,
            stream=True,
        )

        output = ""
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta:
                content = chunk.choices[0].delta.content
                if content:
                    output += content

        return output

    except Exception as e:
        print(f"❌ HF LLM Error: {e}", file=sys.stderr)
        return ""

# ============================================================
# ENGINE
# ============================================================

class MedicalPlanGenerator:
    """
    Clinical-grade Medical AI Planning Engine
    (HF | Llama-3.1-8B-Instruct | Hospital-grade prompting)
    """

    def __init__(self, target_col: str = "Level"):
        self.target_col = target_col
        sys.stdout.reconfigure(encoding='utf-8')
        print(f"🚀 Initializing Clinical Reasoning Engine (HF | {HF_MODEL})...", file=sys.stderr, flush=True)

    # ---------------- DATA PROFILE ----------------

    def get_dataset_profile(self, df: pd.DataFrame) -> str:
        col_stats = []
        for col in df.columns:
            dtype = str(df[col].dtype)
            missing = int(df[col].isnull().sum())
            unique = int(df[col].nunique())
            samples = list(df[col].dropna().unique()[:5])

            stat_str = (
                f"- Column: `{col}` | Type: {dtype} | Missing: {missing} | "
                f"Unique Values: {unique} | Sample Data: {samples}"
            )
            col_stats.append(stat_str)

        return "\n".join(col_stats)

    # ============================================================
    # PHASE 1 — CLINICAL STRATEGY REPORT
    # ============================================================

    def generate_clinical_report(self, df: pd.DataFrame) -> str:
        print("\n--- Phase 1: Generating Clinical Strategy Report ---", file=sys.stderr, flush=True)
        profile = self.get_dataset_profile(df)

        prompt = f"""
SYSTEM ROLE:
You are a **Chief Clinical Informatics Officer (CCIO)**, **Clinical AI Architect**, and **Principal Biomedical Data Scientist**.
You design regulatory-grade AI systems for hospitals, public health agencies, and medical research institutions.

You follow:
- Clinical epidemiology
- Biomedical signal modeling
- EHR informatics standards
- Population health analytics
- Bias-safe AI design
- FDA SaMD principles
- HIPAA/GDPR governance
- Medical AI interpretability frameworks

==================================================
TASK:
Generate a **Clinical Data Strategy Report** for predictive modeling.

TARGET VARIABLE:
'{self.target_col}'

==================================================
DATASET PROFILE:
{profile}

==================================================
CLINICAL ANALYSIS INSTRUCTIONS:

Reason using **clinical semantics**, not data types.

Analyze:
- Physiological meaning
- Pathophysiological relevance
- Clinical interpretability
- Diagnostic relevance
- Prognostic relevance
- Population health impact
- Risk stratification value
- Predictive stability
- Confounding risk
- Leakage risk
- Proxy discrimination risk
- Bias amplification risk
- Ethical implications
- Privacy sensitivity
- Governance classification
- Regulatory sensitivity

==================================================
STRUCTURE:

## 1. Clinical Executive Summary
## 2. Clinical Privacy & Governance Framework
## 3. Missing Data Clinical Strategy
## 4. Clinical Feature Engineering Strategy
## 5. Clinical Modeling Readiness

==================================================
STYLE:
Medical-grade • Academic • Regulatory-grade

FORMAT: Markdown  
LENGTH: 500–700 words
"""

        return ask_hf_llm(prompt)

    # ============================================================
    # PHASE 2 — EXECUTION PLAN
    # ============================================================

    def _robust_json_generation(self, prompt: str, df_cols) -> Dict[str, Any]:
        for attempt in range(3):
            raw = ask_hf_llm(prompt)
            clean = extract_json_block(raw)
            repaired = auto_repair_json(clean)

            try:
                data = json.loads(repaired)

                # completeness validation
                if len(data.keys()) < len(df_cols):
                    raise ValueError("Incomplete AI plan (missing columns)")

                return data
            except Exception as e:
                print(f"⚠️ JSON retry {attempt+1}: {e}", file=sys.stderr)

        raise RuntimeError("❌ Critical failure: Invalid JSON from HF LLM")

    def _normalize_plan(self, data: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {}
        for col, info in data.items():
            if not isinstance(info, dict):
                continue
            normalized[col] = {
                "action": info.get("action"),
                "params": info.get("params"),
                "reason": info.get("reason")
            }
        return normalized

    def generate_plan_from_report(self, df: pd.DataFrame, report: str) -> Dict[str, Any]:
        print("\n--- Phase 2: Generating Execution Plan ---", file=sys.stderr, flush=True)
        profile = self.get_dataset_profile(df)

        prompt = f"""
SYSTEM ROLE:
You are a **Principal Clinical ML Architect** and **Biomedical AI Engineer**.

==================================================
CLINICAL STRATEGY REPORT:
{report}

==================================================
DATASET PROFILE:
{profile}

==================================================
TARGET VARIABLE:
'{self.target_col}'

==================================================
TASK:
Design a **clinically-safe, regulation-ready preprocessing pipeline**.

==================================================
AVAILABLE TRANSFORMATIONS:

drop, impute(mean/mode), scale, one_hot_encode, label_encode

==================================================
STRICT CLINICAL RULES:

- EVERY column must appear exactly once
- NO missing columns
- NO duplicates
- NO dtype-based logic
- Biomedical reasoning only
- Prevent leakage
- Prevent proxy discrimination
- Preserve biological signal
- Preserve interpretability
- Maintain patient privacy
- Regulatory safe
- Hospital safe

==================================================
OUTPUT CONSTRAINTS:

- VALID JSON ONLY
- NO markdown
- NO text
- NO comments
- NO explanations outside JSON

==================================================
JSON FORMAT:

{{
  "Column_Name": {{
    "action": "drop|impute|scale|one_hot_encode|label_encode",
    "params": "mean|mode|null",
    "reason": "Clinically grounded biomedical justification"
  }}
}}

==================================================
Return JSON ONLY.
"""

        data = self._robust_json_generation(prompt, df.columns)
        return self._normalize_plan(data)

    # ============================================================
    # RUN
    # ============================================================

    def run(self, df: pd.DataFrame):
        report = self.generate_clinical_report(df)
        plan = self.generate_plan_from_report(df, report)
        return plan, report

# ============================================================
# CLI
# ============================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("file_path", help="Path to CSV")
    parser.add_argument("--regenerate", help="Report text to regenerate plan from", default=None)
    args = parser.parse_args()

    try:
        try:
            raw_df = pd.read_csv(args.file_path, sep=None, engine='python')
        except:
            raw_df = pd.read_csv(args.file_path)

        generator = MedicalPlanGenerator()

        if args.regenerate:
            plan = generator.generate_plan_from_report(raw_df, args.regenerate)
            print("__PLAN_START__")
            print(json.dumps(plan, indent=2))
            print("__PLAN_END__")

        else:
            plan, explanation = generator.run(raw_df)

            print("__PLAN_START__", flush=True)
            print(json.dumps(plan, indent=2), flush=True)
            print("__PLAN_END__", flush=True)
            
            print("__EXPLANATION_START__", flush=True)
            print(explanation, flush=True)
            print("__EXPLANATION_END__", flush=True)

    except Exception as e:
        print(f"❌ Execution Failed: {e}", file=sys.stderr)
