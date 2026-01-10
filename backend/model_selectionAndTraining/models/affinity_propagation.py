import joblib
import pandas as pd
from sklearn.cluster import AffinityPropagation
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from metrics_utils import calculate_metrics

def train(X_train, y_train, X_test, y_test, train_path, test_path, target_col, save_path):
    print("Training Affinity Propagation...")
    X_combined = pd.concat([X_train, X_test])
    
    # Sampling if data is huge because Affinity Prop crashes on >10k rows usually
    if len(X_combined) > 3000:
        print("   (Sampling data to 3000 rows for Affinity Propagation performance)")
        X_train_fit = X_combined.sample(3000, random_state=42)
    else:
        X_train_fit = X_combined

    model = AffinityPropagation(random_state=42, damping=0.9)
    labels = model.fit_predict(X_train_fit)
    
    metrics = calculate_metrics(X_train_fit, labels)
    
    joblib.dump(model, save_path)
    return {"algo": "AffinityPropagation", **metrics}