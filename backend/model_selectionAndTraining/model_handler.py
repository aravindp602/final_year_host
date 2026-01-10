import sys
import os
import json
import pandas as pd
import importlib.util # <--- This is the secret ingredient for Cloud paths
import traceback
import shutil
from sklearn.model_selection import train_test_split

# ---------------------------------------------------------
# 1. SETUP PATHS
# ---------------------------------------------------------
current_dir = os.path.dirname(os.path.abspath(__file__))
models_dir = os.path.join(current_dir, "models")
trained_models_dir = os.path.join(current_dir, "trained_models")

# Ensure output directory exists
os.makedirs(trained_models_dir, exist_ok=True)

# ---------------------------------------------------------
# 2. HELPER: ROBUST MODEL LOADER (The Fix)
# ---------------------------------------------------------
def load_model_script(algo_name):
    """
    Loads a python script directly by file path.
    This works on ANY system (Win/Mac/Linux/Cloud).
    """
    try:
        # Construct the absolute path to the file
        script_path = os.path.join(models_dir, f"{algo_name}.py")
        
        if not os.path.exists(script_path):
            print(f"   [ERROR] Script file not found: {script_path}")
            return None

        # Load file directly
        spec = importlib.util.spec_from_file_location(f"models.{algo_name}", script_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[f"models.{algo_name}"] = module
        spec.loader.exec_module(module)
        return module
    except Exception as e:
        print(f"   [ERROR] Could not load script {algo_name}: {e}")
        return None

# ---------------------------------------------------------
# 3. LOAD DATA
# ---------------------------------------------------------
if len(sys.argv) < 3:
    print("Usage: python model_handler.py <dataset_path> <models_json>")
    sys.exit(1)

dataset_path = sys.argv[1]
models_config = json.loads(sys.argv[2])

try:
    df = pd.read_csv(dataset_path)
except Exception as e:
    print(f"[ERROR] Error loading dataset: {e}")
    sys.exit(1)

if df.empty:
    print("[ERROR] Dataset is empty.")
    sys.exit(1)

target_col = df.columns[-1]
feature_cols = df.columns[:-1]

X = df[feature_cols]
y = df[target_col]

# Save split files
if len(df) > 5:
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
else:
    X_train, X_test, y_train, y_test = X, X, y, y

# ---------------------------------------------------------
# 4. EXECUTION LOGIC
# ---------------------------------------------------------
results = []
best_global_score = -2
best_global_model_path = ""
best_global_algo = ""

# Check if Auto-ML (m0) is requested
# We check for ID 'm0' OR name 'best_cluster_algo'
run_automl = any(m.get('id') == 'm0' or m.get('name') == 'best_cluster_algo' for m in models_config)

if run_automl:
    print("\n [AUTO-ML] Starting search for Best Clustering Algorithm...")
    target_algos = [
        "kmeans", "minibatch_kmeans", "k_medoids", "gmm", 
        "dbscan", "optics", "hierarchical", "meanshift", 
        "birch", "affinity_propagation", "spectral"
    ]
else:
    # Explicit model request
    target_algos = []
    # Try to load mapping file
    mapping_path = os.path.join(current_dir, "model_names.json")
    if os.path.exists(mapping_path):
        with open(mapping_path, 'r') as f:
            mapping = json.load(f)
        
        for m_req in models_config:
            # Find matching algo name from ID
            found = next((x for x in mapping if x['id'] == m_req.get('id')), None)
            if found:
                target_algos.append(found['name']) 
            elif m_req.get('algo'):
                target_algos.append(m_req.get('algo'))
    else:
        target_algos = [m.get('algo') for m in models_config if m.get('algo')]

# Loop through algorithms
for algo in target_algos:
    print(f"   ...Testing {algo}")
    
    # USE THE ROBUST LOADER
    module = load_model_script(algo)
    if not module: continue

    save_path = os.path.join(trained_models_dir, f"{algo}_model.pkl")

    try:
        # Call the train function inside the script
        metrics = module.train(
            X_train, y_train, 
            X_test, y_test, 
            dataset_path, dataset_path,
            target_col,
            save_path
        )

        # Calculate Score for Comparison
        score = metrics.get("silhouette_score", -2)
        if isinstance(score, str): score = -2

        # Track Best Model
        if score > best_global_score:
            best_global_score = score
            best_global_model_path = save_path
            best_global_algo = algo

        results.append({
            "model": algo,
            "metrics": metrics,
            "path": save_path
        })

    except Exception as e:
        print(f"   [ERROR] Training {algo} failed: {e}")
        # traceback.print_exc()

# ---------------------------------------------------------
# 5. FINALIZE & OUTPUT
# ---------------------------------------------------------

if not results:
    print("[ERROR] Auto-ML Failed: All candidate models failed to train or returned invalid metrics.")
else:
    # Rename best model to standard name
    final_best_path = os.path.join(trained_models_dir, "best_model.pkl")
    
    if os.path.exists(best_global_model_path):
        shutil.copy2(best_global_model_path, final_best_path)
        
        # Ensure the winner is first in the JSON list (for frontend)
        results.sort(key=lambda x: x['metrics'].get("silhouette_score", -2) if isinstance(x['metrics'].get("silhouette_score"), (int, float)) else -2, reverse=True)
        results[0]['path'] = final_best_path
        
        print(f"====== BEST MODEL FOUND: {best_global_algo} (Score: {best_global_score:.4f}) ======")
    else:
        print("[WARNING] Best model file missing.")

print("\n__JSON_START__")
print(json.dumps(results))
print("__JSON_END__")