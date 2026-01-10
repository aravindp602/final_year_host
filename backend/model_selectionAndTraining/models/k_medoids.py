import joblib
import pandas as pd
from sklearn_extra.cluster import KMedoids
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from metrics_utils import calculate_metrics

def train(X_train, y_train, X_test, y_test, train_path, test_path, target_col, save_path):
    print("Training K-Medoids...")
    X_combined = pd.concat([X_train, X_test])
    
    # K-Medoids is computationally expensive (O(N^2)). 
    # If dataset is huge (>10k rows), we sample it for the training phase
    # to keep the UI responsive.
    if len(X_combined) > 5000:
        print(f"   (Sampling data to 5000 rows for K-Medoids performance)")
        X_train_fit = X_combined.sample(5000, random_state=42)
    else:
        X_train_fit = X_combined

    best_score = -1
    best_model = None
    best_metrics = {}

    # Tuning K (2 to 10)
    for k in range(2, 11):
        try:
            # metric='manhattan' is standard for K-Medoids (less sensitive to outliers)
            # method='pam' is the classic accurate algorithm
            model = KMedoids(n_clusters=k, metric='manhattan', method='pam', random_state=42)
            
            labels = model.fit_predict(X_train_fit)
            
            metrics = calculate_metrics(X_train_fit, labels)
            
            if metrics["silhouette_score"] > best_score:
                best_score = metrics["silhouette_score"]
                best_model = model
                best_metrics = metrics
        except Exception as e:
            print(f"   K-Medoids failed for k={k}: {e}")
            continue

    # Save the best model
    joblib.dump(best_model, save_path)
    
    return {"algo": "KMedoids", **best_metrics}