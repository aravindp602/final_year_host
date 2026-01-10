import joblib
import pandas as pd
from sklearn.cluster import SpectralClustering
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from metrics_utils import calculate_metrics

def train(X_train, y_train, X_test, y_test, train_path, test_path, target_col, save_path):
    print(" Training Spectral Clustering...")
    X_combined = pd.concat([X_train, X_test])
    
    # Sampling if data is huge (Spectral is heavy on memory)
    if len(X_combined) > 2000:
        print("   (Sampling data to 2000 rows for Spectral Clustering performance)")
        X_train_fit = X_combined.sample(2000, random_state=42)
    else:
        X_train_fit = X_combined

    best_score = -1
    best_model = None
    best_metrics = {}
    
    # Tuning K
    for k in range(2, 8):
        # assign_labels='discretize' is often more stable
        model = SpectralClustering(n_clusters=k, assign_labels='discretize', random_state=42)
        labels = model.fit_predict(X_train_fit)
        
        metrics = calculate_metrics(X_train_fit, labels)
        if metrics["silhouette_score"] > best_score:
            best_score = metrics["silhouette_score"]
            best_model = model
            best_metrics = metrics

    # NOTE: Spectral models cannot simple 'predict' on new data later. 
    # But we save it anyway for consistency.
    joblib.dump(best_model, save_path)
    
    return {"algo": "SpectralClustering", **best_metrics}