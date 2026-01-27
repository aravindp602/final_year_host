import pandas as pd
from google import genai          # ✅ new SDK
from groq import Groq
import os
import sys
import json
from dotenv import load_dotenv

# Load environment variables from .env file
# We look for .env in the parent directory (backend/)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# =====================================================
# CONFIGURE MODELS (SECURE)
# =====================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY   = os.getenv("GROQ_API_KEY")

if not GEMINI_API_KEY:
    print("Warning: GEMINI_API_KEY not found in .env", file=sys.stderr)
if not GROQ_API_KEY:
    print("Warning: GROQ_API_KEY not found in .env", file=sys.stderr)

# ---------------- Gemini (NEW SDK) ----------------
if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)   # ✅ new style client
else:
    gemini_client = None

# ---------------- Groq ----------------
if GROQ_API_KEY:
    groq_client = Groq(api_key=GROQ_API_KEY)
else:
    groq_client = None

GROQ_MODEL   = "llama-3.3-70b-versatile"
GEMINI_MODEL = "gemini-2.5-flash"   # or gemini-1.5-flash if needed

# =====================================================
# FAST DATASET LOADER
# =====================================================

def load_any_dataset(file_path):
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".csv":
        return pd.read_csv(file_path, nrows=50)
    elif ext in [".xlsx", ".xls"]:
        return pd.read_excel(file_path, nrows=50)
    elif ext == ".json":
        return pd.read_json(file_path)[:50]
    elif ext in [".txt", ".tsv"]:
        try:
            return pd.read_csv(file_path, sep="\t", nrows=50)
        except:
            return pd.read_csv(file_path, sep=None, engine="python", nrows=50)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

# =====================================================
# HELPERS
# =====================================================

def clean_domain(text: str) -> str:
    if not text:
        return "Unknown"
    return text.replace("Domain:", "").replace("domain:", "").strip()

def detect_target_column(df: pd.DataFrame):
    """
    Heuristic target column detection for AutoML:
    - last column
    - not ID-like
    - not unique
    - not datetime
    - not long free text
    """
    if df.shape[1] == 0:
        return None

    last_col = df.columns[-1]
    col_name = str(last_col).lower()

    # Exclusions
    if col_name.startswith("unnamed"): 
        return None
    if "id" in col_name: 
        return None
    if "date" in col_name or "time" in col_name:
        return None
    if df[last_col].nunique() == len(df): 
        return None

    # Text-like column exclusion
    if df[last_col].dtype == "object":
        avg_len = df[last_col].astype(str).str.len().mean()
        if avg_len > 40:
            return None

    return last_col

def build_prompt(columns, sample):
    return f"""
You are a domain classification engine.

Identify the dataset domain from the schema and sample.

Allowed domains ONLY:
- Medical
- Finance
- Cybersecurity
- IoT
- Education

Columns:
{columns}

Sample Row:
{sample}

Return exactly in this format:
Domain: <Medical|Finance|Cybersecurity|IoT|Education>
"""

# =====================================================
# MODEL CALLS
# =====================================================

def ask_gemini(columns, sample):
    if not gemini_client:
        return "Error: No Gemini Key"
    try:
        prompt = build_prompt(columns, sample)

        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )

        return clean_domain(response.text)

    except Exception as e:
        return f"Error: {str(e)}"

def ask_groq(columns, sample):
    if not groq_client:
        return "Error: No Groq Key"
    try:
        prompt = build_prompt(columns, sample)

        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )

        return clean_domain(response.choices[0].message.content)

    except Exception as e:
        return f"Error: {str(e)}"

# =====================================================
# VOTING LOGIC
# =====================================================

def majority_domain(domains):
    # Filter errors
    valid = [d for d in domains if d and not d.startswith("Error")]
    if not valid:
        return "Unknown"

    freq = {}
    for d in valid:
        freq[d] = freq.get(d, 0) + 1

    return max(freq, key=freq.get)

# =====================================================
# MAIN PIPELINE
# =====================================================

def detect_domain_from_file(file_path):
    df = load_any_dataset(file_path)
    target_col = detect_target_column(df)

    columns = list(df.columns)[:20]
    sample = df.head(1).to_dict()

    gemini_domain = ask_gemini(columns, sample)
    groq_domain   = ask_groq(columns, sample)

    final_domain = majority_domain([gemini_domain, groq_domain])

    # Backend debug logs only
    print(f"[DomainDetection] Gemini : {gemini_domain}", file=sys.stderr)
    print(f"[DomainDetection] Groq   : {groq_domain}", file=sys.stderr)
    print(f"[DomainDetection] Final  : {final_domain}", file=sys.stderr)

    return gemini_domain, groq_domain, final_domain, target_col

# =====================================================
# ENTRY POINT
# =====================================================

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
        
    file_path = sys.argv[1]

    try:
        gemini_domain, groq_domain, final_domain, target_col = detect_domain_from_file(file_path)

        # ✅ ONLY JSON to frontend
        print(json.dumps({
            "gemini_domain": gemini_domain,
            "groq_domain": groq_domain,
            "final_domain": final_domain,
            "target_column": target_col
        }))

    except Exception as e:
        # Safe fallback JSON
        print(json.dumps({
            "error": str(e),
            "gemini_domain": "Error",
            "groq_domain": "Error",
            "final_domain": "Medical",   # safe default
            "target_column": None
        }))
