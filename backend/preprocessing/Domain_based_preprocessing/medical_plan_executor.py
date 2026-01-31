import sys
import os
import json
import pandas as pd
import numpy as np
from scipy import stats
from sklearn.preprocessing import StandardScaler, LabelEncoder, MinMaxScaler, PolynomialFeatures
# Explicitly enabling experimental MICE
from sklearn.experimental import enable_iterative_imputer 
from sklearn.impute import IterativeImputer
from sklearn.decomposition import PCA
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
# [LOGGING DISABLED]
# if os.path.exists(LOG_DIR):
#     try: shutil.rmtree(LOG_DIR)
#     except: pass
# os.makedirs(LOG_DIR, exist_ok=True)
# print(f"Logging intermediate steps to: {LOG_DIR}")

def save_log(df, step_num, step_name):
    pass
    # [LOGGING DISABLED]
    # filename = f"{step_num}_{step_name.lower().replace(' ', '_')}.csv"
    # path = os.path.join(LOG_DIR, filename)
    # df.to_csv(path, index=False)
    # print(f"   --> Saved log: {filename}")

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
def get_cols_with_action(action_keys, module_ids=None):
    if isinstance(action_keys, str): action_keys = [action_keys]
    if isinstance(module_ids, str): module_ids = [module_ids]
    if module_ids is None: module_ids = []
    
    action_keys = [k.lower() for k in action_keys]
    module_ids = [m.lower() for m in module_ids]

    cols = []
    for col, details in plan.items():
        if col not in df.columns: continue
        
        steps = details.get("steps", [])
        for step in steps:
            act = step.get("action", "").lower()
            mod = step.get("moduleId", "").lower()

            if act in action_keys or mod in module_ids:
                cols.append((col, step.get("params", {})))
                
    return cols

# ================================
# EXECUTION PIPELINE
# ================================
step_counter = 1

# ---------------- 1. REMOVE DUPLICATES (dp1) ----------------
dedup_tasks = get_cols_with_action(["remove_duplicates", "remove duplicates"], "dp1")
if dedup_tasks or "remove_duplicates" in str(plan).lower(): 
    print(f"Running Remove Duplicates...")
    prev_len = len(df)
    df.drop_duplicates(inplace=True)
    curr_len = len(df)
    print(f"   -> Removed {prev_len - curr_len} duplicate rows.")
    save_log(df, step_counter, "removed_duplicates")
    step_counter += 1

# ---------------- 2. DROP COLUMNS (dp_drop) ----------------
drop_tasks = get_cols_with_action(["drop", "drop_column", "drop column"], "dp_drop")
cols_to_drop = list(set([c[0] for c in drop_tasks]))

if cols_to_drop:
    print(f"Running Drop Logic on {len(cols_to_drop)} columns...")
    df.drop(columns=cols_to_drop, inplace=True, errors='ignore')
    save_log(df, step_counter, "dropped_cols")
    step_counter += 1

# ---------------- 3. IMPUTATION (dp2) ----------------
impute_tasks = get_cols_with_action(["impute", "handle_missing_values", "handle missing values"], "dp2")
if impute_tasks:
    print(f"Running Imputation (MICE Only) on {len(impute_tasks)} columns...")
    cols_to_impute = list(set([c[0] for c in impute_tasks if c[0] in df.columns]))
    numeric_cols = [c for c in cols_to_impute if pd.api.types.is_numeric_dtype(df[c])]
    
    if numeric_cols:
        try:
            print(f"   -> Applying Iterative Imputer to {len(numeric_cols)} numeric columns...")
            imputer = IterativeImputer(max_iter=10, random_state=0)
            df[numeric_cols] = imputer.fit_transform(df[numeric_cols])
        except Exception as e:
            print(f" MICE Imputation Failed: {e}")
    
    save_log(df, step_counter, "imputed_data")
    step_counter += 1

# ---------------- 4. OUTLIER REMOVAL (dp3) ----------------
outlier_tasks = get_cols_with_action(["outlier_removal", "outlier removal", "remove_outliers"], "dp3")
if outlier_tasks:
    print(f"Running Outlier Removal (Z-Score) on specified columns...")
    cols_to_check = list(set([c[0] for c in outlier_tasks if c[0] in df.columns and pd.api.types.is_numeric_dtype(df[c[0]])]))
    
    if cols_to_check:
        prev_len = len(df)
        z_scores = np.abs(stats.zscore(df[cols_to_check]))
        df = df[(z_scores < 3).all(axis=1)]
        curr_len = len(df)
        print(f"   -> Removed {prev_len - curr_len} outlier rows.")
        
    save_log(df, step_counter, "outliers_removed")
    step_counter += 1

# ---------------- 5. POLYNOMIAL FEATURES (dp5) ----------------
poly_tasks = get_cols_with_action(["polynomial_features", "polynomial features"], "dp5")
if poly_tasks:
    print(f"Running Polynomial Features generation...")
    cols_to_poly = list(set([c[0] for c in poly_tasks if c[0] in df.columns and pd.api.types.is_numeric_dtype(df[c[0]])]))
    
    if cols_to_poly:
        try:
            poly = PolynomialFeatures(degree=2, include_bias=False)
            poly_data = poly.fit_transform(df[cols_to_poly])
            feature_names = poly.get_feature_names_out(cols_to_poly)
            
            poly_df = pd.DataFrame(poly_data, columns=feature_names, index=df.index)
            
            # Remove original columns and add new features
            df = df.drop(columns=cols_to_poly)
            df = pd.concat([df, poly_df], axis=1)
            print(f"   -> Expanded {len(cols_to_poly)} columns into {len(feature_names)} polynomial features.")
        except Exception as e:
            print(f"Polynomial Features Failed: {e}")

    save_log(df, step_counter, "polynomial_features")
    step_counter += 1

# ---------------- 6. LOG TRANSFORM (dp6) ----------------
log_tasks = get_cols_with_action(["log", "log_transform", "log transform"], "dp6")
if log_tasks:
    print(f"Running Log Transform on {len(log_tasks)} columns...")
    for col, _ in log_tasks:
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            if (df[col] >= 0).all():
                df[col] = np.log1p(df[col])
            else:
                print(f" Skipping Log on {col} (negative values found)")
    
    save_log(df, step_counter, "log_transformed")
    step_counter += 1

# ---------------- 7. ENCODING (dp7) ----------------
encode_tasks = get_cols_with_action(["encode", "encoding"], "dp7")
if encode_tasks:
    print(f"Running Encoding on {len(encode_tasks)} columns...")
    
    label_cols = [c for c, p in encode_tasks if p == 'label_encoder']
    onehot_cols = [c for c, p in encode_tasks if p == 'one_hot_encoder']
    
    for c, p in encode_tasks:
        if c not in label_cols and c not in onehot_cols and c in df.columns:
            if pd.api.types.is_object_dtype(df[c]): onehot_cols.append(c)
            else: label_cols.append(c)

    if label_cols:
        le = LabelEncoder()
        for c in label_cols:
            if c in df.columns:
                df[c] = le.fit_transform(df[c].astype(str))

    valid_oh_cols = [c for c in onehot_cols if c in df.columns]
    if valid_oh_cols:
        df = pd.get_dummies(df, columns=valid_oh_cols, drop_first=True)
        bool_cols = df.select_dtypes(include=['bool']).columns
        df[bool_cols] = df[bool_cols].astype(int)

    save_log(df, step_counter, "encoded_data")
    step_counter += 1

# ---------------- 8. SCALING (dp8) & NORMALIZATION (dp9) ----------------
scale_tasks = get_cols_with_action(["scale", "scaling", "standard_scaler"], "dp8")
if scale_tasks:
    print(f"Running StandardScaler on {len(scale_tasks)} columns...")
    valid_scale_cols = [c[0] for c in scale_tasks if c[0] in df.columns and pd.api.types.is_numeric_dtype(df[c[0]])]
    if valid_scale_cols:
        scaler = StandardScaler()
        df[valid_scale_cols] = scaler.fit_transform(df[valid_scale_cols])

norm_tasks = get_cols_with_action(["normalization", "normalize", "minmax_scaler"], "dp9")
if norm_tasks:
    print(f"Running MinMaxScaler on {len(norm_tasks)} columns...")
    valid_norm_cols = [c[0] for c in norm_tasks if c[0] in df.columns and pd.api.types.is_numeric_dtype(df[c[0]])]
    if valid_norm_cols:
        minmax = MinMaxScaler()
        df[valid_norm_cols] = minmax.fit_transform(df[valid_norm_cols])

if scale_tasks or norm_tasks:
    save_log(df, step_counter, "scaled_normalized")
    step_counter += 1

# ---------------- 9. PCA (dp10) ----------------
pca_tasks = get_cols_with_action(["pca", "principal_component_analysis"], "dp10")
if pca_tasks:
    print(f"Running PCA...")
    
    target_cols = [c[0] for c in pca_tasks if c[0] in df.columns]
    
    # If no specific columns found, take all numeric
    if not target_cols:
         target_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    if target_cols:
        try:
            n_components = 0.95 
            for _, params in pca_tasks:
                if 'n_components' in params:
                    n_components = params['n_components']
                    break
            
            n_features = len(target_cols)
            if isinstance(n_components, int) and n_components > n_features:
                n_components = n_features
            
            pca = PCA(n_components=n_components)
            subset = df[target_cols]
            
            pca_data = pca.fit_transform(subset)
            
            pc_cols = [f"PC{i+1}" for i in range(pca_data.shape[1])]
            df_pca = pd.DataFrame(pca_data, columns=pc_cols, index=df.index)
            
            df = df.drop(columns=target_cols)
            df = pd.concat([df, df_pca], axis=1)
            
            print(f"   -> PCA applied to {len(target_cols)} columns. Reduced to {df_pca.shape[1]} components.")
            print(f"   -> Dataset shape after PCA: {df.shape}")
            
            save_log(df, step_counter, "pca_applied")
            step_counter += 1
        except Exception as e:
            print(f"PCA Failed: {e}")

# ---------------- FINAL CLEANUP ----------------
print("Final data sanitization...")
obj_cols = df.select_dtypes(include=['object']).columns
if len(obj_cols) > 0:
    print(f" Dropping remaining non-numeric columns: {list(obj_cols)}")
    df.drop(columns=obj_cols, inplace=True)

df.replace([np.inf, -np.inf], np.nan, inplace=True)
df.fillna(0, inplace=True)

# Final Check
if df.empty or df.shape[1] == 0:
    print("__JSON_RESULT_START__")
    print(json.dumps({
        "status": "error",
        "message": "Preprocessing resulted in an empty dataset. Please check your drop/PCA settings."
    }))
    print("__JSON_RESULT_END__")
    sys.exit(1)

try:
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Preprocessing done. Saved: {OUTPUT_PATH}")
    
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
    sys.stdout.flush()
    print("__JSON_RESULT_START__")
    print(json.dumps({
        "status": "error",
        "message": f"Error saving output: {str(e)}"
    }))
    print("__JSON_RESULT_END__")
    sys.stdout.flush()
    sys.exit(1)