import sys
import os
import json
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder
import shutil

# --- CONFIGURATION ---
# Force UTF-8 for Windows/Mac compatibility
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
    try:
        shutil.rmtree(LOG_DIR)
    except Exception as e:
        print(f"Warning: Could not clean log dir: {e}")
os.makedirs(LOG_DIR, exist_ok=True)
print(f"Logging intermediate steps to: {LOG_DIR}")

def save_log(df, step_num, step_name):
    """Saves an intermediate CSV for the frontend logs"""
    clean_name = step_name.lower().replace(" ", "_")
    filename = f"{step_num}_{clean_name}.csv"
    path = os.path.join(LOG_DIR, filename)
    df.to_csv(path, index=False)
    # The frontend looks for this specific log format
    print(f"   --> Saved log: {filename}")

# --- LOAD DATA ---
try:
    df = pd.read_csv(DATASET_PATH)
    plan = json.loads(PLAN_JSON)
    print(f"Loaded dataset with shape: {df.shape}")
except Exception as e:
    print(f"Error loading data or plan: {e}")
    sys.exit(1)

# --- EXECUTION ENGINE ---
# We execute in a specific order: DROP -> ENCODE -> SCALE
step_counter = 1

# 1. DROP (Do this first to reduce memory and noise)
cols_to_drop = [col for col, details in plan.items() if details['action'] == 'drop']
if cols_to_drop:
    print(f"Running Drop Columns ({len(cols_to_drop)} columns)...")
    existing_drops = [c for c in cols_to_drop if c in df.columns]
    if existing_drops:
        df.drop(columns=existing_drops, inplace=True)
        save_log(df, step_counter, "dropped_identifiers")
        step_counter += 1

# 2. ENCODING (One-Hot)
# We handle One-Hot separately because it expands columns
cols_to_ohe = [col for col, details in plan.items() if details['action'] == 'one_hot_encode']
if cols_to_ohe:
    print(f"Running One-Hot Encoding ({len(cols_to_ohe)} columns)...")
    existing_ohe = [c for c in cols_to_ohe if c in df.columns]
    if existing_ohe:
        df = pd.get_dummies(df, columns=existing_ohe, drop_first=True)
        # Convert bool to int (0/1)
        cols_bool = df.select_dtypes(include='bool').columns
        df[cols_bool] = df[cols_bool].astype(int)
        
        save_log(df, step_counter, "one_hot_encoded")
        step_counter += 1

# 3. ENCODING (Label)
cols_to_le = [col for col, details in plan.items() if details['action'] == 'label_encode']
if cols_to_le:
    print(f"Running Label Encoding ({len(cols_to_le)} columns)...")
    le = LabelEncoder()
    changed = False
    for col in cols_to_le:
        if col in df.columns:
            df[col] = le.fit_transform(df[col].astype(str))
            changed = True
    
    if changed:
        save_log(df, step_counter, "label_encoded")
        step_counter += 1

# 4. SCALING
cols_to_scale = [col for col, details in plan.items() if details['action'] == 'scale']
if cols_to_scale:
    print(f"Running Scaling ({len(cols_to_scale)} columns)...")
    scaler = StandardScaler()
    # Only scale numeric columns that exist
    existing_scale = [c for c in cols_to_scale if c in df.columns and pd.api.types.is_numeric_dtype(df[c])]
    
    if existing_scale:
        df[existing_scale] = scaler.fit_transform(df[existing_scale])
        save_log(df, step_counter, "scaled_features")
        step_counter += 1

# --- FINALIZE ---
# Ensure no non-numeric columns remain (simple fallback cleanup)
df.fillna(0, inplace=True)

try:
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Preprocessing done. Saved: {OUTPUT_PATH}")
except Exception as e:
    print(f"Error saving output: {e}")
    sys.exit(1)