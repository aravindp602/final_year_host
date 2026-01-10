import joblib
import pandas as pd
import numpy as np
from sklearn.cluster import OPTICS
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from metrics_utils import calculate_metrics

def train(X_train, y_train, X_test, y_test, train_path, test_path, target_col, save_path):
    print("Training OPTICS (Auto-Tuning)...")
    X_combined = pd.concat([X_train, X_test])
    
    # OPTICS is sensitive. We need to try different 'min_samples' and 'xi'.
    # min_samples: How many points make a cluster?
    # xi: Steepness threshold for cluster boundaries.
    param_grid = [
        {'min_samples': 5, 'xi': 0.05},
        {'min_samples': 10, 'xi': 0.05},
        {'min_samples': 20, 'xi': 0.05},
        {'min_samples': 5, 'xi': 0.01},
        {'min_samples': 10, 'xi': 0.01},
        {'min_samples': 30, 'xi': 0.05},
    ]

    best_score = -2 # Silhouette score range is -1 to 1
    best_model = None
    best_metrics = {
        "silhouette_score": "N/A",
        "davies_bouldin_score": "N/A", 
        "calinski_harabasz_score": "N/A"
    }
    
    found_valid_model = False

    for params in param_grid:
        try:
            model = OPTICS(
                min_samples=params['min_samples'], 
                xi=params['xi'], 
                n_jobs=-1 # Use all CPU cores
            )
            labels = model.fit_predict(X_combined)
            
            # Calculate metrics
            metrics = calculate_metrics(X_combined, labels)
            score = metrics["silhouette_score"]
            
            # We only care if we found valid clusters (> 1 cluster, and not just errors)
            if isinstance(score, float) and score > best_score:
                print(f"   > Found better config: {params} -> Score: {score:.4f}")
                best_score = score
                best_model = model
                best_metrics = metrics
                found_valid_model = True
        except Exception as e:
            continue

    # Fallback: If grid search failed to find ANY valid cluster split, 
    # train a default one just so the pipeline doesn't crash.
    if not found_valid_model or best_model is None:
        print("   [WARNING] OPTICS could not find valid clusters with grid search. Using default.")
        best_model = OPTICS(min_samples=5).fit(X_combined)
        best_metrics = calculate_metrics(X_combined, best_model.labels_)

    joblib.dump(best_model, save_path)
    
    return {"algo": "OPTICS", **best_metrics}