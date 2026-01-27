import sys
import os
import json
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.impute import SimpleImputer
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
    try:
        shutil.rmtree(LOG_DIR)
    except Exception as e:
        print(f"Warning: Could not clean log dir: {e}")
os.makedirs(LOG_DIR, exist_ok=True)
print(f"Logging intermediate steps to: {LOG_DIR}")

def save_log(df, step_num, step_name):
    clean_name = step_name.lower().replace(" ", "_")
    filename = f"{step_num}_{clean_name}.csv"
    path = os.path.join(LOG_DIR, filename)
    df.to_csv(path, index=False)
    print(f"   --> Saved log: {filename}")

# --- LOAD DATA ---
try:
    df = pd.read_csv(DATASET_PATH)
    plan = json.loads(PLAN_JSON)
    print(f"Loaded dataset with shape: {df.shape}")
except Exception as e:
    print(f"Error loading data or plan: {e}")
    sys.exit(1)

# ================================
# EXECUTION ENGINE
# Order:
# DROP -> IMPUTE -> ONE-HOT -> LABEL -> SCALE -> FINAL CLEAN
# ================================

step_counter = 1

# ----------------
# 1. DROP
# ----------------
cols_to_drop = [col for col, details in plan.items() if details['action'] == 'drop']
if cols_to_drop:
    print(f"Running Drop Columns ({len(cols_to_drop)} columns)...")
    existing = [c for c in cols_to_drop if c in df.columns]
    if existing:
        df.drop(columns=existing, inplace=True)
        save_log(df, step_counter, "dropped_columns")
        step_counter += 1

# ----------------
# 2. IMPUTE
# ----------------
cols_to_impute = [col for col, details in plan.items() if details['action'] == 'impute']
if cols_to_impute:
    print(f"Running Imputation ({len(cols_to_impute)} columns)...")

    mean_cols = []
    mode_cols = []

    for col in cols_to_impute:
        if col in df.columns:
            strategy = plan[col].get('params', 'mean')
            if strategy == 'mean':
                mean_cols.append(col)
            else:
                mode_cols.append(col)

    # Mean imputation (numeric)
    if mean_cols:
        for c in mean_cols:
            df[c] = pd.to_numeric(df[c], errors='coerce')
        imp_mean = SimpleImputer(strategy='mean')
        df[mean_cols] = imp_mean.fit_transform(df[mean_cols])

    # Mode imputation (categorical/ordinal)
    if mode_cols:
        imp_mode = SimpleImputer(strategy='most_frequent')
        df[mode_cols] = imp_mode.fit_transform(df[mode_cols])

    save_log(df, step_counter, "imputed_values")
    step_counter += 1

# ----------------
# 3. ONE-HOT ENCODING
# ----------------
cols_to_ohe = [col for col, details in plan.items() if details['action'] == 'one_hot_encode']
if cols_to_ohe:
    print(f"Running One-Hot Encoding ({len(cols_to_ohe)} columns)...")
    existing = [c for c in cols_to_ohe if c in df.columns]
    if existing:
        df = pd.get_dummies(df, columns=existing, drop_first=True)

        # Convert booleans to int
        bool_cols = df.select_dtypes(include='bool').columns
        df[bool_cols] = df[bool_cols].astype(int)

        save_log(df, step_counter, "one_hot_encoded")
        step_counter += 1

# ----------------
# 4. LABEL ENCODING
# ----------------
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

# ----------------
# 5. SCALING
# ----------------
cols_to_scale = [col for col, details in plan.items() if details['action'] == 'scale']
if cols_to_scale:
    print(f"Running Scaling ({len(cols_to_scale)} columns)...")

    numeric_scale = []
    for c in cols_to_scale:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors='coerce')
            if pd.api.types.is_numeric_dtype(df[c]):
                numeric_scale.append(c)

    if numeric_scale:
        scaler = StandardScaler()
        df[numeric_scale] = scaler.fit_transform(df[numeric_scale])

        save_log(df, step_counter, "scaled_features")
        step_counter += 1

# ----------------
# FINAL CLEANING
# ----------------
print("Final data sanitization...")

# Replace inf/nan
df.replace([np.inf, -np.inf], np.nan, inplace=True)
df.fillna(0, inplace=True)

# Enforce numeric types where possible
for col in df.columns:
    try:
        df[col] = pd.to_numeric(df[col])
    except:
        pass

# ----------------
# SAVE OUTPUT
# ----------------
try:
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Preprocessing done. Saved: {OUTPUT_PATH}")
except Exception as e:
    print(f"Error saving output: {e}")
    sys.exit(1)
