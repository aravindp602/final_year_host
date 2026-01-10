import pickle
import pandas as pd
from sklearn.cluster import MiniBatchKMeans
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from metrics_utils import calculate_metrics

# Helper to calculate metrics inline (safest approach)
def calculate_metrics(X, labels):
    try:
        # Silhouette requires at least 2 clusters and < N samples
        if len(set(labels)) < 2 or len(set(labels)) >= len(X):
            return {"silhouette": -1, "calinski": 0, "davies": 10}
            
        sil = silhouette_score(X, labels)
        ch = calinski_harabasz_score(X, labels)
        db = davies_bouldin_score(X, labels)
        return {"silhouette": sil, "calinski": ch, "davies": db}
    except:
        return {"silhouette": -1, "calinski": 0, "davies": 10}

def train(X_train, y_train, X_test, y_test, train_path, test_path, target_col, save_path):
    print("Training MiniBatch KMeans...")
    
    # Combine for clustering (Unsupervised uses all data usually)
    X_combined = pd.concat([X_train, X_test])
    
    # Ensure numeric
    X_combined = X_combined.select_dtypes(include=['number']).fillna(0)

    best_score = -1
    best_model = None
    best_metrics = {}
    
    # Auto-tune K (2 to 10)
    for k in range(2, 11):
        try:
            model = MiniBatchKMeans(n_clusters=k, random_state=42, batch_size=256, n_init='auto')
            labels = model.fit_predict(X_combined)
            
            metrics = calculate_metrics(X_combined, labels)
            
            # Maximize Silhouette Score
            if metrics["silhouette"] > best_score:
                best_score = metrics["silhouette"]
                best_model = model  # <--- SAVE THE OBJECT, NOT THE LABELS
                best_metrics = metrics
        except Exception as e:
            print(f"   [WARNING] K={k} failed: {e}")
            continue

    if best_model is None:
        raise Exception("MiniBatch KMeans failed to converge for any K.")

    # --- USE PICKLE TO SAVE (Matches Output Handler) ---
    with open(save_path, 'wb') as f:
        pickle.dump(best_model, f)
        
    print(f"   -> Best K={best_model.n_clusters} (Silhouette={best_score:.4f})")

    return best_metrics