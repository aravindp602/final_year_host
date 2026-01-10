import joblib
import pandas as pd
from sklearn.cluster import Birch
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from metrics_utils import calculate_metrics

def train(X_train, y_train, X_test, y_test, train_path, test_path, target_col, save_path):
    print(" Training Birch...")
    X_combined = pd.concat([X_train, X_test])
    
    # Birch needs a number of clusters (like KMeans) or None (subclusters)
    # We'll tune it similarly to KMeans
    best_score = -1
    best_model = None
    best_metrics = {}

    for k in range(2, 11):
        model = Birch(n_clusters=k)
        labels = model.fit_predict(X_combined)
        
        metrics = calculate_metrics(X_combined, labels)
        if metrics["silhouette_score"] > best_score:
            best_score = metrics["silhouette_score"]
            best_model = model
            best_metrics = metrics

    joblib.dump(best_model, save_path)
    return {"algo": "Birch", **best_metrics}