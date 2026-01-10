# backend/model_selectionAndTraining/models/metrics_utils.py
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score
import numpy as np

def calculate_metrics(X, labels):
    """
    Calculates Clustering Metrics:
    1. Silhouette Coefficient (SIL) [-1 to 1, higher is better]
    2. Davies-Bouldin Index (DBI) [0 to infinity, lower is better]
    3. Calinski-Harabasz Index (CHI) [higher is better]
    """
    # Filter out noise (-1) for density models like DBSCAN/OPTICS if needed,
    # but standard practice often includes them to penalize noise.
    # However, sklearn metrics require at least 2 clusters and size > n_clusters.
    
    unique_labels = set(labels)
    n_clusters = len(unique_labels) - (1 if -1 in unique_labels else 0)
    
    metrics = {
        "silhouette_score": 0,
        "davies_bouldin_score": 0,
        "calinski_harabasz_score": 0,
        "n_clusters": len(unique_labels)
    }

    # Safety check: Metrics require at least 2 clusters and 2 samples
    if len(unique_labels) < 2 or len(X) <= len(unique_labels):
        return metrics

    try:
        # 1. Silhouette (Computationally expensive on large data, sample if needed)
        if len(X) > 10000:
            # Sampling for speed
            indices = np.random.choice(len(X), 10000, replace=False)
            metrics["silhouette_score"] = silhouette_score(X.iloc[indices], labels[indices])
        else:
            metrics["silhouette_score"] = silhouette_score(X, labels)

        # 2. Davies-Bouldin
        metrics["davies_bouldin_score"] = davies_bouldin_score(X, labels)

        # 3. Calinski-Harabasz
        metrics["calinski_harabasz_score"] = calinski_harabasz_score(X, labels)
        
    except Exception as e:
        print(f"[Metrics Error] {e}")

    return metrics