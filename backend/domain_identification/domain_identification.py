import pandas as pd
import os
import sys
import re
import json
import subprocess
import difflib 

# =====================================================
# CONFIG (LOCAL MODELS ONLY)
# =====================================================

QWEN_MODEL  = "qwen2.5:3b"
LLAMA_MODEL = "llama3.2:latest"
GEMMA_MODEL = "gemma:2b"

ALLOWED_DOMAINS = ["Medical", "Finance", "Cybersecurity", "IoT", "Other"]

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
    """Extract ONLY the domain name from model output."""

    if not text:
        return "Other"

    text = text.split("\n")[0]
    text = text.replace("Domain:", "")
    text = re.sub(r"[^a-zA-Z ]", " ", text).strip()

    if not text:
        return "Other"

    # exact match
    for d in ALLOWED_DOMAINS:
        if text.lower() == d.lower():
            return d

    # fuzzy match
    match = difflib.get_close_matches(text, ALLOWED_DOMAINS, n=1, cutoff=0.6)
    if match:
        return match[0]

    return "Other"


def build_prompt(columns, sample):
    return f"""
Identify the dataset domain from the following information.

Allowed domains:
Medical, Finance, Cybersecurity, IoT, Other

Columns:
{columns}

Sample:
{sample}

Rules:
- Choose ONLY from the allowed domains.
- Do not explain.
- Output EXACTLY in this format:

Domain: <name>
"""


def ask_model(model_name, columns, sample):
    prompt = build_prompt(columns, sample)

    try:
        result = subprocess.run(
            ["ollama", "run", model_name],
            input=prompt,
            text=True,
            capture_output=True,
            timeout=180  # increased timeout
        )

        if result.returncode != 0:
            print(f"Ollama failed for {model_name}: {result.stderr}", file=sys.stderr)
            return "Other"

        return clean_domain(result.stdout.strip())

    except Exception as e:
        print(f"Model call failed ({model_name}): {e}", file=sys.stderr)
        return "Other"


def majority_vote(domains):
    """
    Final decision logic:
    - If ≥2 models agree → that domain
    - If all disagree → Unable to make Decision
    """

    freq = {}
    for d in domains:
        freq[d] = freq.get(d, 0) + 1

    max_count = max(freq.values())

    if max_count < 2:
        return "Unable to make Decision"

    return sorted(freq.items(), key=lambda x: (-x[1], x[0]))[0][0]

# =====================================================
# MAIN PIPELINE
# =====================================================

def detect_domain_from_file(file_path):
    df = load_any_dataset(file_path)

    columns = list(df.columns)[:20]
    sample = df.head(1).to_dict()

    qwen_domain  = ask_model(QWEN_MODEL, columns, sample)
    llama_domain = ask_model(LLAMA_MODEL, columns, sample)
    gemma_domain = ask_model(GEMMA_MODEL, columns, sample)

    final_domain = majority_vote([
        qwen_domain,
        llama_domain,
        gemma_domain
    ])

    # backend logs (stderr only)
    print("Qwen Domain  :", qwen_domain, file=sys.stderr)
    print("LLaMA Domain :", llama_domain, file=sys.stderr)
    print("Gemma Domain :", gemma_domain, file=sys.stderr)
    print("Final Domain :", final_domain, file=sys.stderr)

    return qwen_domain, llama_domain, gemma_domain, final_domain

# =====================================================
# ENTRY POINT
# =====================================================

if __name__ == "__main__":
    file_path = sys.argv[1]

    qwen_domain, llama_domain, gemma_domain, final_domain = \
        detect_domain_from_file(file_path)

    # JSON output to frontend
    print(json.dumps({
        "models_used": [
            "qwen2.5:3b (local)",
            "llama3.2:latest (local)",
            "gemma:2b (local)"
        ],
        "qwen_domain": qwen_domain,
        "llama_domain": llama_domain,
        "gemma_domain": gemma_domain,
        "final_domain": final_domain,
    }))