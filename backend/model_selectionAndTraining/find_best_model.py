import os
import pandas as pd
import importlib.util
import json
import sys
import model_selectionAndTraining.models as models
sys.modules["models"] = models


# ---------------------------------------------------------
# 1. SETUP PATHS
# ---------------------------------------------------------
current_dir = os.path.dirname(os.path.abspath(__file__))
models_dir = os.path.join(current_dir, "models")
model_names_file = os.path.join(current_dir, "model_names.json")

CANDIDATE_MODELS = {}

try:
    if os.path.exists(model_names_file):
        with open(model_names_file, 'r') as f:
            all_models_config = json.load(f)
        for m in all_models_config:
            if m.get("type") == "model" and m["name"] != "best_cluster_algo":
                CANDIDATE_MODELS[m["name"]] = m["name"]
    else:
        print(f"[WARNING] {model_names_file} not found.")
except Exception as e:
    print(f"[ERROR] Failed to read config: {e}")

# ---------------------------------------------------------
# 2. HELPERS
# ---------------------------------------------------------
def load_model_script(algo_name):
    try:
        script_path = os.path.join(models_dir, f"{algo_name}.py")
        if not os.path.exists(script_path): return None
        spec = importlib.util.spec_from_file_location(f"models.{algo_name}", script_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[f"models.{algo_name}"] = module
        spec.loader.exec_module(module)
        return module
    except: return None

def normalize_metrics(metrics):
    if not metrics: return {}
    standardized = metrics.copy()
    key_map = {
        'silhouette': ['silhouette', 'silhouette_score', 'sil'],
        'calinski': ['calinski', 'calinski_harabasz', 'calinski_harabasz_score', 'ch', 'chi'],
        'davies': ['davies', 'davies_bouldin', 'davies_bouldin_score', 'db', 'dbi']
    }
    for std_key, aliases in key_map.items():
        if std_key in standardized: continue
        for alias in aliases:
            for m_key in metrics.keys():
                if m_key.lower() == alias:
                    standardized[std_key] = metrics[m_key]
                    break 
            if std_key in standardized: break
    return standardized

def train_candidate(name, script_name, X_train, y_train, X_test, y_test, train_path, test_path, target_col, output_dir):
    try:
        module = load_model_script(script_name)
        if not module: return None

        model_path = os.path.join(output_dir, f"candidate_{name}.pkl")
        metrics = module.train(
            X_train, y_train, 
            X_test, y_test, 
            train_path, test_path, 
            target_col,
            model_path
        )
        return {
            "model": name, 
            "label": name.replace("_", " ").title(),
            "metrics": metrics,
            "path": model_path,
            "internal_name": name
        }
    except Exception as e:
        print(f"   [ERROR] Training {name} failed: {e}")
        return None

# ---------------------------------------------------------
# 3. RUNNER
# ---------------------------------------------------------
def run(X_train, y_train, X_test, y_test, train_path, test_path, target_col, output_dir):
    print("\n [AUTO-ML] Starting search for Best Clustering Algorithm...", flush=True)
    
    if not CANDIDATE_MODELS:
        print("   [ERROR] No candidate models found.")
        return None

    candidates = []

    for name, script_name in CANDIDATE_MODELS.items():
        print(f"   ...Testing {name}", flush=True)
        res = train_candidate(name, script_name, X_train, y_train, X_test, y_test, train_path, test_path, target_col, output_dir)
        
        if res:
            raw_metrics = res['metrics']
            std_metrics = normalize_metrics(raw_metrics)
            std_metrics['algorithm'] = res['label']
            
            if all(k in std_metrics for k in ['silhouette', 'calinski', 'davies']):
                res['metrics'] = std_metrics
                candidates.append(res)
            else:
                print(f"   [SKIP] {name} missing standard metrics.", flush=True)

    if not candidates:
        print("[ERROR] All candidate models failed.")
        return None

    data = []
    for i, c in enumerate(candidates):
        data.append({
            'index': i,
            'sil': float(c['metrics']['silhouette']),
            'ch': float(c['metrics']['calinski']),
            'db': float(c['metrics']['davies'])
        })
    
    df_rank = pd.DataFrame(data)
    df_rank['r_sil'] = df_rank['sil'].rank(ascending=False) 
    df_rank['r_ch']  = df_rank['ch'].rank(ascending=False)  
    df_rank['r_db']  = df_rank['db'].rank(ascending=True)   
    df_rank['final_score'] = (df_rank['r_sil'] * 0.5) + (df_rank['r_ch'] * 0.25) + (df_rank['r_db'] * 0.25)

    best_row = df_rank.sort_values(by='final_score').iloc[0]
    winner = candidates[int(best_row['index'])]
    winner['model'] = f"Best: {winner['label']}"
    
    print(f"\n====== BEST MODEL FOUND: {winner['label']} (Score: {best_row['final_score']:.2f}) ======\n", flush=True)
    
    return winner