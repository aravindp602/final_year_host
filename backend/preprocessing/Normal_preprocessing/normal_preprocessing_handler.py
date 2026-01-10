import sys
import os
import json
import importlib
import pandas as pd
import chardet
import csv
import shutil
import time
import stat

# --- PATH SETUP ---
# This sets ROOT_DIR to ".../backend"
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT_DIR not in sys.path:
    sys.path.append(ROOT_DIR)

sys.stdout.reconfigure(encoding='utf-8')

# ---------------------------------------------------------
# HELPER: Robust Deletion (Handles OneDrive/Windows Locks)
# ---------------------------------------------------------
def on_rm_error(func, path, exc_info):
    """
    Error handler for shutil.rmtree.
    If the error is due to read-only access, change the file mode and retry.
    """
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception as e:
        pass 

def force_delete_path(path, retries=5, delay=1.0):
    """
    Attempts to delete a file or directory multiple times.
    """
    if not os.path.exists(path):
        return

    for i in range(retries):
        try:
            if os.path.isdir(path):
                shutil.rmtree(path, onerror=on_rm_error)
            else:
                # Force write permission if it's a file
                os.chmod(path, stat.S_IWRITE)
                os.remove(path)
                
            # Check if it's actually gone
            if not os.path.exists(path):
                return
        except OSError as e:
            if i == retries - 1:
                print(f"[WARNING] Could not delete {os.path.basename(path)}: {e}")
            else:
                time.sleep(delay)

# ---------------------------------------------------------
# 1. CLEANUP ROUTINE
# ---------------------------------------------------------
current_script_dir = os.path.dirname(os.path.abspath(__file__))

# --- A. Delete 'branch_*' FOLDERS in 'Normal_preprocessing' (Current Dir) ---
for item in os.listdir(current_script_dir):
    item_path = os.path.join(current_script_dir, item)
    
    if os.path.isdir(item_path) and item.startswith("branch"):
        force_delete_path(item_path)
        if not os.path.exists(item_path):
             print(f" [CLEANUP] Deleted old folder: {item}")

# --- B. Delete 'branch_*.csv' FILES in 'backend' (Root Dir) ---
# We scan ROOT_DIR because your screenshots show the CSVs are there.
for item in os.listdir(ROOT_DIR):
    item_path = os.path.join(ROOT_DIR, item)
    
    # Check for CSV files starting with "branch_" or "main_branch_"
    if os.path.isfile(item_path) and item.endswith(".csv"):
        if item.startswith("branch") or item.startswith("main_branch"):
            force_delete_path(item_path)
            if not os.path.exists(item_path):
                print(f" [CLEANUP] Deleted old file from Root: {item}")

# ---------------------------------------------------------

dataset_path = sys.argv[1]
modules_json = sys.argv[2]
output_path = sys.argv[3]
log_dir = sys.argv[4] if len(sys.argv) > 4 else None

# Load mapping file
json_path = os.path.join(os.path.dirname(__file__), "normal_preprocessing_modules.json")

try:
    with open(json_path, "r", encoding="utf-8") as f:
        module_map = json.load(f)
except FileNotFoundError:
    print(f"[ERROR] Mapping file not found: {json_path}")
    sys.exit(1)

id_to_label = {m["id"]: m["name"] for m in module_map}

modules = json.loads(modules_json)

# --- CLEAN AND CREATE LOG DIRECTORY ---
if log_dir:
    if os.path.exists(log_dir):
        print(f"Cleaning existing log directory: {log_dir}")
        force_delete_path(log_dir)
    
    try:
        os.makedirs(log_dir, exist_ok=True)
        print(f"Logging intermediate steps to: {log_dir}")
    except OSError as e:
        print(f"[ERROR] Could not create log dir: {e}")
# --------------------------------------

# Load dataset safely
def load_dataset(path):
    if not os.path.exists(path):
        print(f"[ERROR] Dataset not found at: {path}")
        sys.exit(1)
        
    with open(path, "rb") as f:
        raw_data = f.read()
        result = chardet.detect(raw_data)
        enc = result["encoding"] or "utf-8"
    
    with open(path, "r", encoding=enc, errors="replace") as f:
        sample = f.read(2048)
        try:
            delim = csv.Sniffer().sniff(sample).delimiter
        except:
            delim = ","

    return pd.read_csv(
        path,
        encoding=enc,
        delimiter=delim,
        on_bad_lines="skip",
        engine="python"
    )

try:
    df = load_dataset(dataset_path)
except Exception as e:
    print(f"[ERROR] Failed to load dataset: {e}")
    sys.exit(1)

def label_to_python_filename(label):
    return label.lower().replace(" ", "_").replace("-", "_")

# Process modules
for i, module in enumerate(modules, 1):
    module_id = module["id"]
    module_label = id_to_label.get(module_id)

    if not module_label:
        print(f"Warning: Module ID {module_id} not found in map.")
        continue

    python_file = label_to_python_filename(module_label)
    print(f"Running {module_label} (id={module_id})...")

    try:
        # Import and Run Module
        mod = importlib.import_module(
            f"preprocessing.Normal_preprocessing.components.{python_file}"
        )
        df = mod.apply(df)
    except Exception as e:
        print(f"[ERROR] Failed running {module_label}: {e}")
        continue 

    if log_dir:
        try:
            clean_name = module_label.replace(" ", "_").lower()
            safe_name = f"{i}_{clean_name}.csv"
            log_path = os.path.join(log_dir, safe_name)
            df.to_csv(log_path, index=False)
            print(f"   --> Saved log: {safe_name}")
        except Exception as e:
            print(f"[WARNING] Failed to save log {safe_name}: {e}")

try:
    df.to_csv(output_path, index=False)
    print("Preprocessing done. Saved:", output_path)
except Exception as e:
    print(f"[ERROR] Failed to save final output: {e}")