import joblib
import pandas as pd
import numpy as np
from sklearn.cluster import DBSCAN
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from metrics_utils import calculate_metrics

def train(X_train, y_train, X_test, y_test, train_path, test_path, target_col, save_path):
    print(" Training DBSCAN...")
    
    X_combined = pd.concat([X_train, X_test])
    
    # DBSCAN is sensitive to 'eps'. We try a few values.
    eps_values = [0.3, 0.5, 0.7, 1.0, 1.5, 2.0]
    
    best_score = -2 # Silhouette range is -1 to 1
    best_eps = 0.5
    best_model = None
    best_metrics = { # Default if everything fails
        "silhouette_score": "N/A",
        "davies_bouldin_score": "N/A", 
        "calinski_harabasz_score": "N/A",
        "n_clusters": 0
    }
    
    for eps in eps_values:
        try:
            db = DBSCAN(eps=eps, min_samples=5)
            labels = db.fit_predict(X_combined)
            
            # Check if we found valid clusters (>1 cluster, excluding noise)
            unique_labels = set(labels)
            if len(unique_labels) > 1:
                
                # Use the shared metrics calculator
                metrics = calculate_metrics(X_combined, labels)
                score = metrics["silhouette_score"]
                
                print(f"   Eps={eps}, Clusters={metrics['n_clusters']}, Score={score:.4f}")
                
                if isinstance(score, float) and score > best_score:
                    best_score = score
                    best_eps = eps
                    best_model = db
                    best_metrics = metrics
                    
        except Exception as e:
            # print(f"   Error for eps={eps}: {e}")
            continue
    
    if best_model is None:
        print("   [WARNING] DBSCAN could not find valid clusters. Using default.")
        best_model = DBSCAN(eps=0.5, min_samples=5).fit(X_combined)
        # Try to calculate metrics one last time on default
        best_metrics = calculate_metrics(X_combined, best_model.labels_)

    joblib.dump(best_model, save_path)
    
    return {
        "algo": "DBSCAN", 
        "best_eps": best_eps, 
        **best_metrics # Return all metrics (SIL, DBI, CHI)
    }