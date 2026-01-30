import sys
import os
import json
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder
# Explicitly enabling experimental MICE
from sklearn.experimental import enable_iterative_imputer 
from sklearn.impute import IterativeImputer
import shutil

# --- CONFIGURATION ---
sys.stdout.reconfigure(encoding='utf-8')

if len(sys.argv) < 5:
    print("Usage: python medical_plan_executor.py <dataset_path> <plan_json> <output_path> <log_dir>")
    sys.exit(1)

DATASET_PATH = sys.argv[1]
PLAN_JSON = sys.argv[2]
OUTPUT_PATH = sys.argv[3]
LOG_DIR = sys.argv[4]

# --- SETUP LOGGING DIRECTORY ---
if os.path.exists(LOG_DIR):
    try: shutil.rmtree(LOG_DIR)
    except: pass
os.makedirs(LOG_DIR, exist_ok=True)
print(f"Logging intermediate steps to: {LOG_DIR}")

def save_log(df, step_num, step_name):
    filename = f"{step_num}_{step_name.lower().replace(' ', '_')}.csv"
    path = os.path.join(LOG_DIR, filename)
    df.to_csv(path, index=False)
    print(f"   --> Saved log: {filename}")

# --- LOAD DATA ---
try:
    df = pd.read_csv(DATASET_PATH)
    plan = json.loads(PLAN_JSON)
    print(f"Loaded dataset with shape: {df.shape}")
except Exception as e:
    print(f"Error loading data: {e}")
    sys.exit(1)

# ================================
# HELPER: Extract Columns for Action
# ================================
def get_cols_with_action(action_keys):
    """
    Scans the plan's 'steps' to find columns that contain specific actions.
    Returns a list of (column_name, parameters).
    """
    if isinstance(action_keys, str): action_keys = [action_keys]
    
    cols = []
    for col, details in plan.items():
        if col not in df.columns: continue
        
        # Check inside the 'steps' list
        steps = details.get("steps", [])
        for step in steps:
            # We check both the raw 'action' key and the mapped 'moduleId'
            act = step.get("action", "").lower()
            if act in action_keys:
                cols.append((col, step.get("params", {})))
                
    return cols

# ================================
# EXECUTION PIPELINE
# ================================
step_counter = 1

# ---------------- 1. DROP COLUMNS ----------------
drop_tasks = get_cols_with_action(["drop", "remove_duplicates", "drop_column"])
cols_to_drop = list(set([c[0] for c in drop_tasks]))

if cols_to_drop:
    print(f"Running Drop Logic on {len(cols_to_drop)} columns...")
    df.drop(columns=cols_to_drop, inplace=True, errors='ignore')
    save_log(df, step_counter, "dropped_cols")
    step_counter += 1

# ---------------- 2. IMPUTATION (MICE ONLY) ----------------
impute_tasks = get_cols_with_action(["impute", "handle_missing_values"])
if impute_tasks:
    print(f"Running Imputation (MICE Only) on {len(impute_tasks)} columns...")
    
    # Identify all columns targeted for imputation (ignoring specific params like 'mean'/'mode')
    cols_to_impute = list(set([c[0] for c in impute_tasks if c[0] in df.columns]))
    
    # Filter for Numeric Columns (MICE requirement)
    numeric_cols = [c for c in cols_to_impute if pd.api.types.is_numeric_dtype(df[c])]
    non_numeric_cols = [c for c in cols_to_impute if c not in numeric_cols]

    # Apply MICE (IterativeImputer)
    if numeric_cols:
        try:
            print(f"   -> Applying Iterative Imputer to {len(numeric_cols)} numeric columns...")
            # MICE: Multivariate Imputation by Chained Equations
            imputer = IterativeImputer(max_iter=10, random_state=0)
            df[numeric_cols] = imputer.fit_transform(df[numeric_cols])
        except Exception as e:
            print(f" MICE Imputation Failed: {e}")
    
    if non_numeric_cols:
        print(f" Skipped imputation for non-numeric columns (MICE requires numeric data): {non_numeric_cols}")

    save_log(df, step_counter, "imputed_data")
    step_counter += 1

# ---------------- 3. LOG TRANSFORM ----------------
log_tasks = get_cols_with_action(["log", "log_transform"])
if log_tasks:
    print(f"Running Log Transform on {len(log_tasks)} columns...")
    for col, _ in log_tasks:
        if pd.api.types.is_numeric_dtype(df[col]):
            # Use log1p to handle zeros safely
            if (df[col] >= 0).all():
                df[col] = np.log1p(df[col])
            else:
                print(f" Skipping Log on {col} (negative values found)")
    
    save_log(df, step_counter, "log_transformed")
    step_counter += 1

# ---------------- 4. ENCODING ----------------
encode_tasks = get_cols_with_action(["encode", "encoding"])
if encode_tasks:
    print(f"Running Encoding on {len(encode_tasks)} columns...")
    
    label_cols = [c for c, p in encode_tasks if p == 'label_encoder']
    onehot_cols = [c for c, p in encode_tasks if p == 'one_hot_encoder']
    
    # Default fallback: Object -> OneHot, Int/Float (Ordinal) -> Label
    for c, p in encode_tasks:
        if c not in label_cols and c not in onehot_cols:
            if pd.api.types.is_object_dtype(df[c]): onehot_cols.append(c)
            else: label_cols.append(c)

    # Label Encode
    if label_cols:
        le = LabelEncoder()
        for c in label_cols:
            df[c] = le.fit_transform(df[c].astype(str))

    # One Hot Encode
    if onehot_cols:
        df = pd.get_dummies(df, columns=onehot_cols, drop_first=True)
        # Fix boolean columns from get_dummies
        bool_cols = df.select_dtypes(include=['bool']).columns
        df[bool_cols] = df[bool_cols].astype(int)

    save_log(df, step_counter, "encoded_data")
    step_counter += 1

# ---------------- 5. SCALING ----------------
scale_tasks = get_cols_with_action(["scale", "scaling"])
if scale_tasks:
    print(f"Running Scaling on {len(scale_tasks)} columns...")
    
    # Filter columns that still exist (some might be dropped or renamed by OHE)
    valid_scale_cols = []
    for c, _ in scale_tasks:
        if c in df.columns and pd.api.types.is_numeric_dtype(df[c]):
            valid_scale_cols.append(c)
    
    if valid_scale_cols:
        scaler = StandardScaler()
        df[valid_scale_cols] = scaler.fit_transform(df[valid_scale_cols])
    
    save_log(df, step_counter, "scaled_data")
    step_counter += 1

# ---------------- FINAL CLEANUP ----------------
print("Final data sanitization...")
# Drop any remaining object columns to ensure ML compatibility
obj_cols = df.select_dtypes(include=['object']).columns
if len(obj_cols) > 0:
    print(f" Dropping remaining non-numeric columns: {list(obj_cols)}")
    df.drop(columns=obj_cols, inplace=True)

df.replace([np.inf, -np.inf], np.nan, inplace=True)
df.fillna(0, inplace=True)

try:
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Preprocessing done. Saved: {OUTPUT_PATH}")
    
    # [FIX] Force flush and print JSON result block for Node.js
    sys.stdout.flush()
    print("__JSON_RESULT_START__")
    print(json.dumps({
        "status": "success", 
        "message": "Preprocessing completed successfully",
        "output_path": OUTPUT_PATH
    }))
    print("__JSON_RESULT_END__")
    sys.stdout.flush()
    
except Exception as e:
    # [FIX] Handle save errors gracefully
    sys.stdout.flush()
    print("__JSON_RESULT_START__")
    print(json.dumps({
        "status": "error",
        "message": f"Error saving output: {str(e)}"
    }))
    print("__JSON_RESULT_END__")
    sys.stdout.flush()
    sys.exit(1)
