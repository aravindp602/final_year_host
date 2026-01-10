import sys
import os
import json
import pandas as pd
import importlib.util
import traceback
import shutil
from sklearn.model_selection import train_test_split

# ---------------------------------------------------------
# 1. SETUP PATHS & LOADERS
# ---------------------------------------------------------
current_dir = os.path.dirname(os.path.abspath(__file__))
models_dir = os.path.join(current_dir, "models")
trained_models_dir = os.path.join(current_dir, "trained_models")
candidate_models_dir = os.path.join(current_dir, "candidate_models")

# Ensure output directories exist
os.makedirs(trained_models_dir, exist_ok=True)
os.makedirs(candidate_models_dir, exist_ok=True)

def load_model_script(algo_name):
    """Loads a python script directly by file path (Bypasses package errors)."""
    try:
        script_path = os.path.join(models_dir, f"{algo_name}.py")
        if not os.path.exists(script_path):
            print(f"   [ERROR] Script not found: {script_path}")
            return None
        spec = importlib.util.spec_from_file_location(f"models.{algo_name}", script_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[f"models.{algo_name}"] = module
        spec.loader.exec_module(module)
        return module
    except Exception as e:
        print(f"   [ERROR] Loader failed for {algo_name}: {e}")
        return None

# Import find_best_model using the robust loader
try:
    find_best_model_path = os.path.join(current_dir, "find_best_model.py")
    spec = importlib.util.spec_from_file_location("find_best_model", find_best_model_path)
    find_best_model = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(find_best_model)
except Exception as e:
    print(f"[WARNING] Could not load find_best_model: {e}")
    find_best_model = None

# ---------------------------------------------------------
# 2. LOAD DATA
# ---------------------------------------------------------
if len(sys.argv) < 3:
    print("Usage: python model_handler.py <dataset_path> <models_json>")
    sys.exit(1)

dataset_path = sys.argv[1]
models_config = json.loads(sys.argv[2])

try:
    df = pd.read_csv(dataset_path)
except:
    sys.exit(1)

target_col = df.columns[-1]
feature_cols = df.columns[:-1]
X = df[feature_cols]
y = df[target_col]

if len(df) > 5:
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
else:
    X_train, X_test, y_train, y_test = X, X, y, y

# Save temp files for consistency
train_path = os.path.join(current_dir, "train_dataset.csv")
test_path = os.path.join(current_dir, "test_dataset.csv")
pd.concat([X_train, y_train], axis=1).to_csv(train_path, index=False)
pd.concat([X_test, y_test], axis=1).to_csv(test_path, index=False)

# ---------------------------------------------------------
# 3. EXECUTION LOOP
# ---------------------------------------------------------
results = []

# Map IDs to script names if needed
model_names_file = os.path.join(current_dir, "model_names.json")
model_file_map = {}
if os.path.exists(model_names_file):
    with open(model_names_file, 'r') as f:
        for m in json.load(f):
            if m.get("type") == "model": model_file_map[m["name"]] = m["name"]

for model_info in models_config:
    model_name = model_info.get("name")
    model_label = model_info.get("label", model_name)
    model_id = model_info.get("id")

    # AUTO-ML CASE
    if model_name == "best_cluster_algo" or model_id == "m0":
        if find_best_model:
            try:
                winner_result = find_best_model.run(
                    X_train, y_train, 
                    X_test, y_test, 
                    train_path, test_path, 
                    target_col, 
                    candidate_models_dir 
                )
                
                if winner_result:
                    final_name = f"best_{winner_result['internal_name']}_model.pkl"
                    dest_path = os.path.join(trained_models_dir, final_name)
                    shutil.copy2(winner_result['path'], dest_path)
                    
                    winner_result['path'] = dest_path
                    results.append(winner_result)
            except Exception as e:
                print(f"[ERROR] Auto-ML Failed: {e}")
                traceback.print_exc()
        else:
            print("[ERROR] Auto-ML requested but find_best_model.py is missing.")

    # SINGLE MODEL CASE
    else:
        # Fallback mapping if name missing
        if model_name not in model_file_map:
             # Try mapping from ID (e.g., m2 -> minibatch_kmeans)
             # This assumes model_names.json structure [ {id: "m2", name: "minibatch_kmeans"...} ]
             # You might need to reload the json to check IDs if 'model_name' is generic.
             pass

        script_name = model_file_map.get(model_name, model_name) # Default to name if mapped
        
        print(f"\n[TRAINING] Training {model_label} ({script_name})...")
        module = load_model_script(script_name)
        
        if module:
            try:
                save_path = os.path.join(trained_models_dir, f"{model_name}_model.pkl")
                metrics = module.train(
                    X_train, y_train, 
                    X_test, y_test, 
                    train_path, test_path, 
                    target_col,
                    save_path
                )
                print(f"[SUCCESS] {model_label} finished.")
                results.append({
                    "model": model_label,
                    "metrics": metrics,
                    "path": save_path
                })
            except Exception as e:
                print(f"[ERROR] Training {model_label} failed: {e}")

print("\n__JSON_START__")
print(json.dumps(results))
print("__JSON_END__")