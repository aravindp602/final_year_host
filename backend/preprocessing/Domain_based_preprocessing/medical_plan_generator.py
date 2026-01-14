import pandas as pd
import json
import re
import sys
import traceback
import os
from typing import Dict, Any, Optional, Tuple
from huggingface_hub import InferenceClient

class MedicalPlanGenerator:
    """
    Advanced Domain-Aware Planning Engine.
    Uses Llama-3 to analyze semantic meaning of medical features 
    to create a clinically valid preprocessing pipeline.
    """
    
    # We allow the AI to choose from these executable actions
    ALLOWED_ACTIONS = {"drop", "impute", "scale", "one_hot_encode", "label_encode"}

    def __init__(
        self,
        hf_token: str,
        # ✅ UPGRADED MODEL (Llama-3.3 70B via Groq/HF)
        model_id: str = "meta-llama/Llama-3.3-70B-Instruct", 
        target_col: str = "Level",
    ):
        if not hf_token:
            raise ValueError("Hugging Face token is required.")
        
        self.client = InferenceClient(token=hf_token)
        self.model_id = model_id
        self.target_col = target_col
        
        # Force UTF-8 for reliable logging
        sys.stdout.reconfigure(encoding='utf-8')
        print(f"🚀 Initializing Clinical Reasoning Engine ({model_id})...", file=sys.stderr, flush=True)

    def _call_api(self, messages: list, max_new_tokens: int) -> str:
        """Executes the LLM inference with high-stakes configuration."""
        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=messages,
                max_tokens=max_new_tokens,
                temperature=0.1, # Near-zero temperature for deterministic output
                stream=False,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"❌ API Request Failed: {e}", file=sys.stderr)
            # Fallback to smaller model if 70B fails or is busy
            if "model_not_found" in str(e) or "404" in str(e):
                print("⚠️ 70B Model unavailable. Falling back to 8B...", file=sys.stderr)
                self.model_id = "meta-llama/Llama-3.1-8B-Instruct"
                return self._call_api(messages, max_new_tokens)
            return ""

    @staticmethod
    def _extract_json(text: str) -> Optional[str]:
        """Robustly extracts JSON payload from mixed natural language output."""
        if not text: return None
        # Attempt to find markdown code blocks
        fenced = re.search(r"```json\s*(.*)```", text, re.DOTALL | re.IGNORECASE)
        candidate = fenced.group(1).strip() if fenced else text
        
        # Fallback: Brute force search for JSON boundaries
        start = candidate.find("{")
        end = candidate.rfind("}")
        
        if start != -1 and end != -1:
            return candidate[start : end + 1]
        return None

    def generate_plan(self, df: pd.DataFrame) -> Dict[str, Any]:
        print("\n--- Generating Clinical Preprocessing Strategy ---", file=sys.stderr, flush=True)
        
        # 1. GENERATE RICH CONTEXT
        col_stats = []
        for col in df.columns:
            dtype = str(df[col].dtype)
            missing_count = int(df[col].isnull().sum())
            unique_count = int(df[col].nunique())
            
            # Extract non-null samples
            samples = list(df[col].dropna().unique()[:5])
            
            stat_str = (
                f"- Column: `{col}` | Type: {dtype} | Missing: {missing_count} | "
                f"Unique Values: {unique_count} | Sample Data: {samples}"
            )
            col_stats.append(stat_str)
            
        column_info = "\n".join(col_stats)

        # 2. SYSTEM PERSONA
        system_prompt = (
            "You are a Principal Data Scientist specializing in Clinical Informatics. "
            "You are tasked with preparing a raw Electronic Health Record (EHR) dataset for a predictive machine learning model. "
            "Your priority is Clinical Validity: preserving biological signals while eliminating administrative noise and bias."
        )

        # 3. ADVANCED REASONING PROMPT
        user_prompt = f"""
Analyze the medical dataset schema below. Perform a semantic analysis of each column to determine its role (Demographic, Vital Sign, ID, or Outcome).
Based on this analysis, construct a preprocessing plan to predict the target: '{self.target_col}'.

### DATASET PROFILING:
{column_info}

### CLINICAL ML TOOLKIT:
Select the most appropriate transformation for each feature from the following strategies:
1. **Drop**: For administrative identifiers (e.g., Patient IDs, Serial Numbers) that carry no biological signal and cause leakage.
2. **Impute**: **Mandatory if 'Missing' > 0**. 
   - Use 'mean' for continuous physiological measures (to preserve population baseline).
   - Use 'most_frequent' for categorical risk factors.
3. **Scale**: For continuous biomarkers (e.g., BMI, Age, Lab Results) to normalize units for algorithms like K-Means.
4. **One-Hot Encode**: For nominal categories (e.g., Gender, History) to prevent ordinal bias.
5. **Label Encode**: For ordinal variables (Low/Med/High) or the specific Target Column.

### OUTPUT REQUIREMENTS:
Return a raw JSON object mapping Column Names to their processing strategy.
Format:
{{
  "Column_Name": {{
    "action": "strategy_name", 
    "params": "optional_parameter", 
    "reason": "Deep clinical justification..."
  }}
}}

**Generate JSON:**
"""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        # Call API
        response = self._call_api(messages, max_new_tokens=4096)
        plan_str = self._extract_json(response)
        
        try:
            return json.loads(plan_str)
        except:
            print(f"❌ JSON Decode Error. Raw response:\n{response}", file=sys.stderr)
            return {}

    def explain_plan_and_guide(self, plan: Dict[str, Any]) -> str:
        """Generates a professional Executive Summary suitable for stakeholders."""
        print("\n--- Generating Executive Report ---", file=sys.stderr, flush=True)
        plan_str = json.dumps(plan, indent=2)
        
        messages = [
            {"role": "system", "content": "You are a Lead AI Researcher presenting to a Medical Review Board."},
            {"role": "user", "content": f"""
Based on the following Preprocessing Plan, generate a structured Executive Summary.

PLAN DATA:
{plan_str}

**REPORT SECTIONS:**
1. **Executive Summary:** High-level assessment of data quality and the chosen strategy.
2. **Signal Preservation (Imputation):** Discuss how missing data was handled to minimize bias (Mean vs Mode reasoning).
3. **Feature Engineering Strategy:** Justify why specific biomarkers were Scaled vs Encoded.
4. **Data Hygiene:** Confirm removal of administrative columns (IDs) to ensure patient privacy and model generalizability.

Format using Markdown. Use authoritative, professional language.
"""}
        ]
        return self._call_api(messages, 2048)

    def run(self, df: pd.DataFrame):
        plan = self.generate_plan(df)
        explanation = self.explain_plan_and_guide(plan)
        return plan, explanation

if __name__ == "__main__":
    if len(sys.argv) < 2: 
        print("Usage: python medical_plan_generator.py <file_path>", file=sys.stderr)
        sys.exit(1)
        
    FILE_PATH = sys.argv[1]
    
    # Robust CSV Loading (Handling flexible engines)
    try:
        raw_df = pd.read_csv(FILE_PATH, sep=None, engine='python')
    except:
        raw_df = pd.read_csv(FILE_PATH)
    
    HF_TOKEN = os.getenv("HF_TOKEN")
    
    generator = MedicalPlanGenerator(HF_TOKEN)
    plan, explanation = generator.run(raw_df)

    # Standard Output for Node.js IPC
    print("__PLAN_START__", flush=True)
    print(json.dumps(plan, indent=2), flush=True)
    print("__PLAN_END__", flush=True)
    
    print("__EXPLANATION_START__", flush=True)
    print(explanation, flush=True)
    print("__EXPLANATION_END__", flush=True)