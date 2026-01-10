import sys
import os
import json
import pandas as pd
import importlib
import traceback
import shutil
from sklearn.model_selection import train_test_split

# ---------------------------------------------------------
# 1. CRITICAL PATH FIX FOR CLOUD HOSTING
# ---------------------------------------------------------
# Get the directory where this script is located
current_dir = os.path.dirname(os.path.abspath(__file__))

# Add this directory to Python's path
if current_dir not in sys.path:
    sys.path.append(current_dir)

# Also add the 'models' subdirectory explicitly
models_dir = os.path.join(current_dir, "models")
if models_dir not in sys.path:
    sys.path.append(models_dir)
# ---------------------------------------------------------

# Try importing find_best_model now that path is fixed
try:
    import find_best_model 
except ImportError:
    # Fallback if find_best_model isn't found (prevents crash on simple runs)
    print("[WARNING] find_best_model.py not found. Auto-ML might fail.")
    find_best_model = None

TRAINED_MODELS_DIR = os.path.join(current_dir, "trained_models")
CANDIDATE_MODELS_DIR = os.path.join(current_dir, "candidate_models")

os.makedirs(TRAINED_MODELS_DIR, exist_ok=True)
os.makedirs(CANDIDATE_MODELS_DIR, exist_ok=True)

if len(sys.argv) < 3:
    print("Usage: python model_handler.py <dataset_path> <models_json>")
    sys.exit(1)

dataset_path = sys.argv[1]
selected_models_json = sys.argv[2]
output_dir = current_dir 

try:
    df = pd.read_csv(dataset_path)
except Exception as e:
    print(f"[ERROR] Error loading dataset: {e}")
    sys.exit(1)

# Handle cases where column extraction might fail on empty dataframes
if df.empty:
    print("[ERROR] Dataset is empty.")
    sys.exit(1)

target_col = df.columns[-1]
feature_cols = df.columns[:-1]

X = df[feature_cols]
y = df[target_col]

# Ensure we have enough data to split
if len(df) > 5:
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
else:
    # Fallback for tiny test datasets
    X_train, X_test, y_train, y_test = X, X, y, y

train_path = os.path.join(output_dir, "train_dataset.csv")
test_path = os.path.join(output_dir, "test_dataset.csv")

train_df = pd.concat([X_train, y_train], axis=1)
test_df = pd.concat([X_test, y_test], axis=1)

train_df.to_csv(train_path, index=False)
test_df.to_csv(test_path, index=False)

selected_models = json.loads(selected_models_json)
results = []

model_names_file = os.path.join(current_dir, "model_names.json")
model_file_map = {}

try:
    if os.path.exists(model_names_file):
        with open(model_names_file, 'r') as f:
            all_models_config = json.load(f)
            
        for m in all_models_config:
            if m.get("type") == "model":
                model_file_map[m["name"]] = m["name"]
    else:
        print(f"[WARNING] {model_names_file} not found. Dynamic mapping failed.")
except Exception as e:
    print(f"[ERROR] Failed to read model_names.json: {e}")
    sys.exit(1)

for model_info in selected_models:
    model_name = model_info.get("name")
    model_label = model_info.get("label")
    model_id = model_info.get("id")

    # Check for "AutoML" flag (m0) or specific name
    if model_name == "best_cluster_algo" or model_id == "m0":
        if find_best_model:
            try:
                print(f"[AUTO-ML] Starting search for Best Clustering Algorithm...")
                winner_result = find_best_model.run(
                    X_train, y_train, 
                    X_test, y_test, 
                    train_path, test_path, 
                    target_col, 
                    CANDIDATE_MODELS_DIR 
                )
                
                if winner_result:
                    source_path = winner_result['path']
                    # We print this so the backend regex can catch it and highlight it green
                    print(f"====== BEST MODEL FOUND: {winner_result.get('model', 'Unknown')} (Score: {winner_result.get('metrics', {}).get('silhouette_score', 0):.4f}) ======")
                    
                    final_model_name = f"best_{winner_result['internal_name']}_model.pkl"
                    dest_path = os.path.join(TRAINED_MODELS_DIR, final_model_name)
                    
                    shutil.copy2(source_path, dest_path)
                    
                    winner_result['path'] = dest_path
                    results.append(winner_result)
                    
            except Exception as e:
                print(f"[ERROR] Auto-ML Failed: {str(e)}")
                traceback.print_exc()
        else:
             print("[ERROR] Auto-ML requested but find_best_model.py is missing.")

    else:
        # Fallback: if model_name isn't in the map (e.g. it came from the frontend ID), try to find it via ID in the loaded json
        if model_name not in model_file_map:
             # Try to find by ID
             found = next((m for m in all_models_config if m["id"] == model_id), None)
             if found:
                 model_name = found["name"] # Switch from ID to Python filename
                 
        if model_name not in model_file_map:
            print(f"[WARNING] No script mapped for {model_name} in model_names.json")
            continue

        script_name = model_file_map[model_name]
        print(f"\n[TRAINING] Training {model_label}...")

        try:
            module = importlib.import_module(f"models.{script_name}")
            
            model_path = os.path.join(TRAINED_MODELS_DIR, f"{model_name}_model.pkl")
            
            metrics = module.train(
                X_train, y_train, 
                X_test, y_test, 
                train_path, test_path, 
                target_col,
                model_path
            )
            
            print(f"[SUCCESS] {model_label} finished.")
            
            results.append({
                "model": model_label,
                "metrics": metrics,
                "path": model_path
            })

        except ImportError:
            print(f"[ERROR] script models/{script_name}.py not found.")
        except Exception as e:
            print(f"[ERROR] Failed to train {model_label}: {str(e)}")
            traceback.print_exc()


print("\n__JSON_START__")
print(json.dumps(results))
print("__JSON_END__")