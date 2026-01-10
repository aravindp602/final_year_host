import sys
import os
import json
import pandas as pd
import importlib.util # <--- Allows loading files by path
import shutil
from sklearn.model_selection import train_test_split

# ---------------------------------------------------------
# 1. SETUP PATHS
# ---------------------------------------------------------
current_dir = os.path.dirname(os.path.abspath(__file__))
models_dir = os.path.join(current_dir, "models")
trained_models_dir = os.path.join(current_dir, "trained_models")

os.makedirs(trained_models_dir, exist_ok=True)

# ---------------------------------------------------------
# 2. HELPER: DIRECT FILE LOADER
# ---------------------------------------------------------
def load_model_script(algo_name):
    """Loads a python script directly by file path."""
    try:
        script_path = os.path.join(models_dir, f"{algo_name}.py")
        if not os.path.exists(script_path):
            print(f"   [ERROR] Script not found: {script_path}")
            return None

        # Magic to load file directly
        spec = importlib.util.spec_from_file_location(f"models.{algo_name}", script_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[f"models.{algo_name}"] = module
        spec.loader.exec_module(module)
        return module
    except Exception as e:
        print(f"   [ERROR] Loader failed for {algo_name}: {e}")
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
except:
    sys.exit(1)

target_col = df.columns[-1]
feature_cols = df.columns[:-1]
X = df[feature_cols]
y = df[target_col]

# Simple Split
if len(df) > 5:
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
else:
    X_train, X_test, y_train, y_test = X, X, y, y

# ---------------------------------------------------------
# 4. EXECUTION LOOP
# ---------------------------------------------------------
results = []
best_global_score = -2
best_global_model_path = ""
best_global_algo = ""

# Check for Auto-ML flag
run_automl = any(m.get('id') == 'm0' or m.get('name') == 'best_cluster_algo' for m in models_config)

if run_automl:
    print("\n [AUTO-ML] Starting search for Best Clustering Algorithm...")
    target_algos = [
        "kmeans", "minibatch_kmeans", "k_medoids", "gmm", 
        "dbscan", "optics", "hierarchical", "meanshift", 
        "birch", "affinity_propagation", "spectral"
    ]
else:
    # Manual selection
    target_algos = []
    mapping_path = os.path.join(current_dir, "model_names.json")
    if os.path.exists(mapping_path):
        with open(mapping_path, 'r') as f:
            mapping = json.load(f)
        for m_req in models_config:
            found = next((x for x in mapping if x['id'] == m_req.get('id')), None)
            if found: target_algos.append(found['name']) 
            elif m_req.get('algo'): target_algos.append(m_req.get('algo'))
    else:
        target_algos = [m.get('algo') for m in models_config if m.get('algo')]

for algo in target_algos:
    print(f"   ...Testing {algo}")
    module = load_model_script(algo)
    if not module: continue

    save_path = os.path.join(trained_models_dir, f"{algo}_model.pkl")

    try:
        # Run training
        metrics = module.train(
            X_train, y_train, 
            X_test, y_test, 
            dataset_path, dataset_path,
            target_col,
            save_path
        )
        
        # Check Score
        score = metrics.get("silhouette_score", -2)
        if isinstance(score, str): score = -2

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

# ---------------------------------------------------------
# 5. FINALIZE
# ---------------------------------------------------------
if not results:
    print("[ERROR] Auto-ML Failed: All candidate models failed.")
else:
    final_best_path = os.path.join(trained_models_dir, "best_model.pkl")
    if os.path.exists(best_global_model_path):
        shutil.copy2(best_global_model_path, final_best_path)
        # Sort for frontend
        results.sort(key=lambda x: x['metrics'].get("silhouette_score", -2) if isinstance(x['metrics'].get("silhouette_score"), (int, float)) else -2, reverse=True)
        results[0]['path'] = final_best_path
        print(f"====== BEST MODEL FOUND: {best_global_algo} (Score: {best_global_score:.4f}) ======")

print("\n__JSON_START__")
print(json.dumps(results))
print("__JSON_END__")