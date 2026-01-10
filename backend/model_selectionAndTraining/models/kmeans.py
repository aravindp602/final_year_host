import joblib
import pandas as pd
from sklearn.cluster import KMeans
# 1. Import the shared metrics utility instead of just silhouette_score
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from metrics_utils import calculate_metrics

def train(X_train, y_train, X_test, y_test, train_path, test_path, target_col, save_path):
    print(" Training K-Means (finding optimal K)...")
    
    # Combine train/test for better clustering (Unsupervised doesn't strictly need split)
    X_combined = pd.concat([X_train, X_test])
    
    best_score = -1
    best_k = 2
    best_model = None
    best_metrics = {} # 2. Initialize dictionary to store the full metrics of the best run
    
    # Try K from 2 to 10
    for k in range(2, 11):
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X_combined)
        
        try:
            # 3. Use the shared function to get SIL, DBI, and CHI
            metrics = calculate_metrics(X_combined, labels)
            score = metrics["silhouette_score"]
            
            print(f"   K={k}, Silhouette={score:.4f}")
            
            if score > best_score:
                best_score = score
                best_k = k
                best_model = kmeans
                best_metrics = metrics # 4. Save the full metrics object
        except Exception as e:
            print(f"   Error for K={k}: {e}")
            continue

    print(f"Best K-Means: K={best_k} (Score: {best_score:.4f})")

    joblib.dump(best_model, save_path)
    
    # 5. Return the full metrics using spread syntax
    return {
        "algo": "KMeans", 
        "best_k": best_k, 
        **best_metrics 
    }