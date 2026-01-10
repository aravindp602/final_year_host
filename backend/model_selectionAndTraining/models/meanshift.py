import joblib
import pandas as pd
from sklearn.cluster import MeanShift, estimate_bandwidth
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from metrics_utils import calculate_metrics

def train(X_train, y_train, X_test, y_test, train_path, test_path, target_col, save_path):
    print("Training MeanShift (Auto-Tuning)...")
    X_combined = pd.concat([X_train, X_test])
    
    # Try different quantiles to find a bandwidth that creates > 1 cluster
    quantiles_to_try = [0.1, 0.15, 0.2, 0.25, 0.3]
    
    best_score = -2
    best_model = None
    best_metrics = {
        "silhouette_score": "N/A",
        "davies_bouldin_score": "N/A", 
        "calinski_harabasz_score": "N/A",
        "n_clusters": 0
    }
    
    found_valid_model = False

    for q in quantiles_to_try:
        try:
            # 1. Estimate bandwidth
            bandwidth = estimate_bandwidth(X_combined, quantile=q, n_samples=500)
            
            if bandwidth is None or bandwidth <= 0:
                continue
                
            # 2. Train Model
            model = MeanShift(bandwidth=bandwidth, bin_seeding=True)
            labels = model.fit_predict(X_combined)
            
            # 3. Check Cluster Count
            n_clusters = len(set(labels))
            if n_clusters < 2 or n_clusters > len(X_combined) - 1:
                continue # Skip valid but useless results (1 cluster or N clusters)

            # 4. Calculate Score
            metrics = calculate_metrics(X_combined, labels)
            score = metrics["silhouette_score"]
            
            print(f"   > Quantile={q}, Bandwidth={bandwidth:.4f}, Clusters={n_clusters}, Score={score:.4f}")
            
            if isinstance(score, float) and score > best_score:
                best_score = score
                best_model = model
                best_metrics = metrics
                found_valid_model = True

        except Exception as e:
            # print(f"   Error for q={q}: {e}")
            continue

    # Fallback if loop failed to find a good split
    if not found_valid_model or best_model is None:
        print("   [WARNING] MeanShift could not find valid clusters. Using default.")
        best_model = MeanShift().fit(X_combined)
        best_metrics = calculate_metrics(X_combined, best_model.labels_)

    joblib.dump(best_model, save_path)
    
    return {"algo": "MeanShift", **best_metrics}