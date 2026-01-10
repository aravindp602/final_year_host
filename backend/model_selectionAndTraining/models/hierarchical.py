import joblib
import pandas as pd
from sklearn.cluster import AgglomerativeClustering
# 1. Import the shared metrics utility
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from metrics_utils import calculate_metrics

def train(X_train, y_train, X_test, y_test, train_path, test_path, target_col, save_path):
    print("Training Hierarchical Clustering...")
    
    # Combine data to get a better global picture
    X_combined = pd.concat([X_train, X_test])

    # AgglomerativeClustering is computationally expensive (O(N^2) or O(N^3)).
    # We MUST sample if the dataset is large, otherwise the UI will freeze for minutes.
    if len(X_combined) > 5000:
        print("   (Sampling data to 5000 rows for Hierarchical performance)")
        X_sample = X_combined.sample(5000, random_state=42)
    else:
        X_sample = X_combined
    
    best_score = -1
    best_k = 2
    best_model = None
    best_metrics = {
        "silhouette_score": "N/A",
        "davies_bouldin_score": "N/A", 
        "calinski_harabasz_score": "N/A"
    }
    
    for k in range(2, 10):
        try:
            hc = AgglomerativeClustering(n_clusters=k)
            labels = hc.fit_predict(X_sample)
            
            # 2. Use shared metrics calculator
            metrics = calculate_metrics(X_sample, labels)
            score = metrics["silhouette_score"]
            
            print(f"   K={k}, Silhouette={score:.4f}")
            
            if score > best_score:
                best_score = score
                best_k = k
                best_model = hc
                best_metrics = metrics
        except Exception as e:
            print(f"   Error for k={k}: {e}")
            continue

    # Fallback if loop failed completely
    if best_model is None:
        best_model = AgglomerativeClustering(n_clusters=2).fit(X_sample)
        best_metrics = calculate_metrics(X_sample, best_model.labels_)

    joblib.dump(best_model, save_path)
    
    # 3. Return all metrics
    return {
        "algo": "Hierarchical", 
        "best_k": best_k, 
        **best_metrics 
    }