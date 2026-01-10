import pandas as pd
import json
import re
import sys
import traceback
import os
from typing import Dict, Any, Optional, Tuple

# Use the official, modern Hugging Face client
from huggingface_hub import InferenceClient

class MedicalPlanGenerator:
    """
    A specialized class that uses the Hugging Face InferenceClient to generate
    a high-quality, domain-aware preprocessing plan using the specified Llama model.
    """
    ALLOWED_ACTIONS = {"drop", "scale", "one_hot_encode", "label_encode"}

    def __init__(
        self,
        hf_token: str,
        model_id: str = "meta-llama/Llama-3.1-8B-Instruct:novita",
        target_col: str = "Level",
    ):
        """Initializes the InferenceClient."""
        if not hf_token:
            raise ValueError("Hugging Face token is required for the Inference API.")

        # This client is the modern, correct way to interact with the HF API
        self.client = InferenceClient(token=hf_token)
        self.model_id = model_id
        self.target_col = target_col

        print(
            f"🚀 Initializing Medical Plan Generator with InferenceClient for model '{model_id}'...",
            file=sys.stderr,
            flush=True
        )
        print("✅ Generator ready.", file=sys.stderr, flush=True)


    def _call_api(self, messages: list, max_new_tokens: int) -> str:
        """Helper function to call the chat completions API."""
        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=messages,
                max_tokens=max_new_tokens,
                temperature=0.1, # Low temperature for strict adherence to rules
                stream=False,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"❌ API Request Failed. Full Error Traceback:", file=sys.stderr, flush=True)
            if hasattr(e, 'response') and e.response is not None:
                 print(f"Response Status: {e.response.status_code}", file=sys.stderr, flush=True)
                 print(f"Response Body: {e.response.text}", file=sys.stderr, flush=True)
            traceback.print_exc(file=sys.stderr)
            return ""

    @staticmethod
    def _extract_json(text: str) -> Optional[str]:
        """Robustly extracts a full JSON object from model output using brace matching."""
        if not text:
            return None

        # Try to find markdown code block first
        fenced = re.search(r"```json\s*(.*)```", text, re.DOTALL | re.IGNORECASE)
        if fenced:
            candidate = fenced.group(1).strip()
        else:
            # Fallback: look for the first opening brace
            start = text.find("{")
            if start == -1:
                return None
            candidate = text[start:]

        # Balance braces to find the end of the JSON object
        depth = 0
        in_string = False
        escape = False
        start_idx = None

        for i, ch in enumerate(candidate):
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "{":
                if depth == 0:
                    start_idx = i
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0 and start_idx is not None:
                    return candidate[start_idx : i + 1].strip()
        return None

    def generate_plan(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generates a domain-aware preprocessing plan using the API."""
        print("\n--- Generating Preprocessing Plan (via API) ---", file=sys.stderr, flush=True)
        
        # Prepare column info
        column_info = "\n".join([f"- `{col}` (dtype: {df[col].dtype}, unique values: {df[col].nunique()})" for col in df.columns])

        # --- ADVANCED SYSTEM PROMPT ---
        system_prompt = (
            "You are a Senior Clinical Data Scientist. "
            "You are analyzing a medical dataset for a research study. "
            "Your job is to clean the data based on **Biological and Clinical Significance**, not just statistics. "
            "You classify variables as 'Administrative' (useless), 'Demographic' (risk factors), or 'Physiological' (signals)."
        )

        # --- ADVANCED DOMAIN-SPECIFIC USER PROMPT ---
        user_prompt = f"""
Analyze the provided medical dataset columns and generate a preprocessing plan to predict the target column: '{self.target_col}'.

**1. Decision Rules (Follow Strictly):**
- **Drop** if the column is an administrative identifier (e.g., Patient ID, Visit Code).
- **Scale** if the column is a continuous biological measurement (e.g., Age, BMI, Blood Pressure, Lab Results).
- **One-Hot Encode** if the column is a nominal category (e.g., Gender, Race, Smoking Status).
- **Label Encode** if the column is ordinal (Low/Med/High) OR if it is the Target Column ('{self.target_col}').

**2. Reasoning Requirements (Crucial):**
- The `"reason"` field MUST explain the **medical nature** of the variable.
- ❌ BAD REASON: "It is an integer with high cardinality."
- ✅ GOOD REASON: "Administrative identifier with no biological predictive value."
- ❌ BAD REASON: "It is a float."
- ✅ GOOD REASON: "Continuous physiological vital sign that varies biologically."
- ❌ BAD REASON: "It is a category."
- ✅ GOOD REASON: "Nominal demographic risk factor."

**Dataset Columns:**
{column_info}

**Output Requirements:**
1. Return ONLY a valid JSON object.
2. Keys = Column Names.
3. Values = Object with `"action"` and `"reason"`.

**Example Output:**
{{
  "Patient_ID": {{"action": "drop", "reason": "Administrative ID; contains no clinical signal."}},
  "Age": {{"action": "scale", "reason": "Demographic variable; scaling aligns biological timeframe."}},
  "Cholesterol": {{"action": "scale", "reason": "Physiological biomarker; requires normalization."}},
  "Gender": {{"action": "one_hot_encode", "reason": "Nominal demographic factor."}}
}}

**Your JSON:**
"""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        response = self._call_api(messages, max_new_tokens=4096)
        
        if not response:
            print("❌ Error: Received no response from API.", file=sys.stderr, flush=True)
            return {}

        plan_str = self._extract_json(response)
        if not plan_str:
            print(f"❌ Error: No JSON object detected in API response.\nRaw response:\n{response}", file=sys.stderr, flush=True)
            return {}

        try:
            plan = json.loads(plan_str)
            print("--- Generated Plan (JSON) ---", file=sys.stderr, flush=True)
            print(json.dumps(plan, indent=2), file=sys.stderr, flush=True)
            return plan
        except json.JSONDecodeError as e:
            print(f"❌ Error decoding JSON: {e}", file=sys.stderr, flush=True)
            print("---- Extracted JSON candidate ----", file=sys.stderr, flush=True)
            print(plan_str, file=sys.stderr, flush=True)
            return {}

    def explain_plan_and_guide(self, plan: Dict[str, Any]) -> str:
        """Generates a detailed clinical explanation using the API."""
        print("\n--- Generating Explanation and Guidance (via API) ---", file=sys.stderr, flush=True)
        if not plan:
            return "No plan was generated to explain."
        plan_str = json.dumps(plan, indent=2)

        # --- ADVANCED EXPLANATION PROMPT ---
        messages = [
            {
                "role": "system",
                "content": "You are a Medical AI Research Mentor. You explain data strategies using clinical terminology (e.g., 'biomarkers', 'confounding variables', 'patient demographics').",
            },
            {
                "role": "user",
                "content": f"""
I have generated a preprocessing plan for a medical dataset to predict '{self.target_col}'.
Plan: {plan_str}

Please generate a comprehensive Markdown report.

**Report Structure:**
1. **Clinical Data Strategy:** Explain why we remove administrative IDs (to prevent leakage) and how we handle biological signals vs. demographics.
2. **Detailed Rationale:** Group columns by action.
   - For 'Scale', explain how this standardizes different biological units (e.g., years vs mg/dL).
   - For 'Encode', explain how this handles qualitative patient history.
3. **Implementation Guide:** A brief Python snippet showing `StandardScaler` and `LabelEncoder` implementation.

Keep the tone professional, medical, and accessible.
""",
            },
        ]

        explanation = self._call_api(messages, max_new_tokens=3072)
        print("--- Generated Report ---", file=sys.stderr, flush=True)
        return explanation

    def run(self, df: pd.DataFrame) -> Tuple[Dict[str, Any], str]:
        """Full pipeline: generate the plan, then generate the explanation."""
        plan = self.generate_plan(df)
        if not plan:
            return {}, "Failed to generate a valid plan."
        explanation = self.explain_plan_and_guide(plan)
        return plan, explanation


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Error: No file path provided.", file=sys.stderr, flush=True)
        sys.exit(1)

    # Command-line arguments
    FILE_PATH = sys.argv[1]
    TARGET_COLUMN = sys.argv[2] if len(sys.argv) > 2 else "Level"

    print(f"--- Loading data from: {FILE_PATH} ---", file=sys.stderr, flush=True)
    try:
        raw_df = pd.read_csv(FILE_PATH)
        print("✅ File loaded successfully.\n", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"❌ Error loading CSV: {e}", file=sys.stderr, flush=True)
        sys.exit(1)

    print("--- Initializing Medical Plan Generator ---", file=sys.stderr, flush=True)
    try:
        HF_TOKEN = os.getenv("HF_TOKEN")
        if not HF_TOKEN:
            raise ValueError(
                "Hugging Face token not found in environment variable HF_TOKEN."
            )

        plan_generator = MedicalPlanGenerator(
            hf_token=HF_TOKEN, target_col=TARGET_COLUMN
        )
        generated_plan, generated_explanation = plan_generator.run(raw_df)

        # Output to STDOUT (Visible in UI)
        # Using flush=True to ensure it appears immediately
        print("__PLAN_START__", flush=True)
        print(json.dumps(generated_plan, indent=2), flush=True)
        print("__PLAN_END__", flush=True)
        
        print("__EXPLANATION_START__", flush=True)
        print(generated_explanation, flush=True)
        print("__EXPLANATION_END__", flush=True)

        print("\n--- Process Complete ---", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}", file=sys.stderr, flush=True)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)