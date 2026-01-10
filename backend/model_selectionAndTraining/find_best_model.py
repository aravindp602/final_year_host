import os
import pandas as pd
import importlib
import traceback
import json
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
model_names_file = os.path.join(current_dir, "model_names.json")

CANDIDATE_MODELS = {}

try:
    if os.path.exists(model_names_file):
        with open(model_names_file, 'r') as f:
            all_models_config = json.load(f)
            
        for m in all_models_config:
            if m.get("type") == "model":
               
                if m["name"] != "best_cluster_algo":
                    CANDIDATE_MODELS[m["name"]] = m["name"]
    else:
        print(f"[WARNING] {model_names_file} not found. find_best_model cannot load candidates.")
except Exception as e:
    print(f"[ERROR] Failed to read model_names.json in find_best_model: {e}")


def normalize_metrics(metrics):
    """
    Standardizes metric keys to 'silhouette', 'calinski', 'davies'.
    PRESERVES any other keys (like 'k', 'n_clusters') found in the input.
    """
    if not metrics: return {}
    
    standardized = metrics.copy()
 
    key_map = {
        'silhouette': ['silhouette', 'silhouette_score', 'sil'],
        'calinski': ['calinski', 'calinski_harabasz', 'calinski_harabasz_score', 'ch', 'chi'],
        'davies': ['davies', 'davies_bouldin', 'davies_bouldin_score', 'db', 'dbi']
    }


    for std_key, aliases in key_map.items():
        if std_key in standardized:
            continue

        for alias in aliases:
            for m_key in metrics.keys():
                if m_key.lower() == alias:
                    standardized[std_key] = metrics[m_key]
                    break 
            if std_key in standardized: break
            
    return standardized

def train_candidate(name, script_name, X_train, y_train, X_test, y_test, train_path, test_path, target_col, output_dir):
    try:
        module = importlib.import_module(f"models.{script_name}")
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

def run(X_train, y_train, X_test, y_test, train_path, test_path, target_col, output_dir):
    print("\n [AUTO-ML] Starting search for Best Clustering Algorithm...", flush=True)
    
    if not CANDIDATE_MODELS:
        print("   [ERROR] No candidate models found to test. Check model_names.json.")
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
                print(f"   [SKIP] {name} missing standard metrics. Received: {list(raw_metrics.keys())}", flush=True)

    if not candidates:
        raise Exception("All candidate models failed to train or returned invalid metrics.")

    data = []
    for i, c in enumerate(candidates):
        data.append({
            'index': i,
            'sil': float(c['metrics']['silhouette']),
            'ch': float(c['metrics']['calinski']),
            'db': float(c['metrics']['davies'])
        })
    
    df_rank = pd.DataFrame(data)
    
    df_rank['r_sil'] = df_rank['sil'].rank(ascending=False) # High = Good
    df_rank['r_ch']  = df_rank['ch'].rank(ascending=False)  # High = Good
    df_rank['r_db']  = df_rank['db'].rank(ascending=True)   # Low = Good

    df_rank['final_score'] = (df_rank['r_sil'] * 0.5) + (df_rank['r_ch'] * 0.25) + (df_rank['r_db'] * 0.25)

    # Sort and pick winner
    best_row = df_rank.sort_values(by='final_score').iloc[0]
    winner = candidates[int(best_row['index'])]
    
    # Update label to indicate it's the winner
    winner['model'] = f"Best: {winner['label']}"
    
    print(f"\n\033[92m====== BEST MODEL FOUND: {winner['label']} (Score: {best_row['final_score']:.2f}) ======\033[0m\n", flush=True)
    
    return winner