import pandas as pd
import google.generativeai as genai
from groq import Groq
import os
import sys
import json
import subprocess
from dotenv import load_dotenv

# Load environment variables from .env file
# We look for .env in the parent directory (backend/)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# =====================================================
# CONFIGURE MODELS (SECURE)
# =====================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY not found in .env", file=sys.stderr)
if not GROQ_API_KEY:
    print("Error: GROQ_API_KEY not found in .env", file=sys.stderr)

# Configure Clients (Graceful fallback if keys missing)
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    # Using 'gemini-1.5-flash' as 2.5 is not standard yet, check your model list
    gemini_model = genai.GenerativeModel("gemini-2.5-flash") 
else:
    gemini_model = None

if GROQ_API_KEY:
    groq_client = Groq(api_key=GROQ_API_KEY)
else:
    groq_client = None

GROQ_MODEL = "llama-3.3-70b-versatile"
OLLAMA_MODEL = "llama3"   # make sure: ollama run llama3 works locally

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

def clean_domain(text):
    return text.replace("Domain:", "").strip()

def detect_target_column(df):
    if df.shape[1] == 0: return None
    last_col = df.columns[-1]
    col_name = str(last_col).lower()
    if col_name.startswith("unnamed"): return None
    if "id" in col_name: return None
    if df[last_col].nunique() == len(df): return None
    if df[last_col].dtype == "object":
        if df[last_col].astype(str).str.len().mean() > 40: return None
    if "date" in col_name or "time" in col_name: return None
    return last_col

def build_prompt(columns, sample):
    return f"""
Identify the domain from these columns and sample.
Allowed domains: Medical, Finance, Cybersecurity, IoT, Education.

Columns: {columns}
Sample: {sample}

Return exactly: Domain: <name>
"""

# =====================================================
# MODEL CALLS
# =====================================================

def ask_gemini(columns, sample):
    if not gemini_model: return "Error: No Key"
    try:
        prompt = build_prompt(columns, sample)
        response = gemini_model.generate_content(prompt, generation_config={"temperature": 0.1})
        return clean_domain(response.text)
    except Exception as e:
        return f"Error: {str(e)}"

def ask_groq(columns, sample):
    if not groq_client: return "Error: No Key"
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

def ask_ollama(columns, sample):
    try:
        prompt = build_prompt(columns, sample)
        # Check if ollama is installed
        result = subprocess.run(
            ["ollama", "run", OLLAMA_MODEL],
            input=prompt,
            text=True,
            capture_output=True
        )
        if result.returncode != 0:
            return "Error: Ollama not running"
        return clean_domain(result.stdout.strip())
    except FileNotFoundError:
        return "Error: Ollama not installed"

def majority_domain(domains):
    # Filter out errors
    valid_domains = [d for d in domains if "Error" not in d]
    if not valid_domains: return "Unknown"
    
    freq = {}
    for d in valid_domains:
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
    ollama_domain = ask_ollama(columns, sample)

    final_domain = majority_domain([gemini_domain, groq_domain, ollama_domain])

    # Debug logs → backend only
    print(f"Gemini Domain : {gemini_domain}", file=sys.stderr)
    print(f"Groq Domain   : {groq_domain}", file=sys.stderr)
    print(f"Ollama Domain : {ollama_domain}", file=sys.stderr)
    print(f"Final Domain  : {final_domain}", file=sys.stderr)

    return gemini_domain, groq_domain, ollama_domain, final_domain, target_col

# =====================================================
# ENTRY POINT
# =====================================================

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
        
    file_path = sys.argv[1]

    try:
        gemini_domain, groq_domain, ollama_domain, final_domain, target_col = detect_domain_from_file(file_path)

        # ✅ ONLY JSON to frontend
        print(json.dumps({
            "gemini_domain": gemini_domain,
            "groq_domain": groq_domain,
            "ollama_domain": ollama_domain,
            "final_domain": final_domain,
            "target_column": target_col
        }))
    except Exception as e:
        # Fallback error JSON
        print(json.dumps({
            "error": str(e),
            "final_domain": "Medical", # Default fallback
            "target_column": "None"
        }))