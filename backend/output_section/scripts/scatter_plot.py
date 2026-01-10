import sys
import os
import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score

# Import utils
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)
from model_utils import load_model_and_predict

def run(dataset_path, model_path):
    print(f"[ScatterPlot] Processing output for model: {os.path.basename(model_path)}")

    # 1. Hybrid Load: Get Data and Cluster Labels
    try:
        df, labels = load_model_and_predict(model_path, dataset_path)
    except Exception as e:
        return {"error": f"Failed to load model or predict: {str(e)}"}
    
    # 2. Prepare Numeric Data (for PCA and Metrics)
    # Create a copy to avoid SettingWithCopy warnings
    numeric_df = df.select_dtypes(include=[np.number]).fillna(0).copy()
    
    # Remove Cluster_ID if it accidentally exists in the features
    if 'Cluster_ID' in numeric_df.columns:
        numeric_df = numeric_df.drop(columns=['Cluster_ID'])

    # --- 3. CALCULATE METRICS (ISOLATED) ---
    metrics = {
        "silhouette_score": "N/A",
        "davies_bouldin_score": "N/A",
        "calinski_harabasz_score": "N/A"
    }

    unique_labels = set(labels)
    
    # Metrics require at least 2 clusters and size > n_clusters
    if len(unique_labels) > 1 and len(numeric_df) > len(unique_labels):
        
        # A. Silhouette Score
        try:
            # For speed, if dataset > 10k rows, sample for Silhouette (O(N^2) complexity)
            if len(numeric_df) > 10000:
                sample_indices = np.random.choice(len(numeric_df), 10000, replace=False)
                metric_sample = numeric_df.iloc[sample_indices]
                label_sample = labels[sample_indices]
                metrics["silhouette_score"] = silhouette_score(metric_sample, label_sample)
            else:
                metrics["silhouette_score"] = silhouette_score(numeric_df, labels)
        except Exception as e:
            print(f"[WARNING] Silhouette calculation failed: {e}")

        # B. Davies-Bouldin Index
        try:
            metrics["davies_bouldin_score"] = davies_bouldin_score(numeric_df, labels)
        except Exception as e:
            print(f"[WARNING] Davies-Bouldin calculation failed: {e}")

        # C. Calinski-Harabasz Index
        try:
            metrics["calinski_harabasz_score"] = calinski_harabasz_score(numeric_df, labels)
        except Exception as e:
            print(f"[WARNING] Calinski-Harabasz calculation failed: {e}")
    
    else:
        print("[INFO] Not enough clusters or data points to calculate metrics.")

    print(f"[ScatterPlot] Calculated Metrics: {metrics}")

    # --- 4. PCA FOR VISUALIZATION ---
    try:
        # Sample for Frontend Performance (Max 1000 points for the plot)
        MAX_POINTS = 1000
        if len(numeric_df) > MAX_POINTS:
            indices = np.random.choice(len(numeric_df), MAX_POINTS, replace=False)
            viz_sample = numeric_df.iloc[indices]
            labels_sample = labels[indices]
        else:
            viz_sample = numeric_df
            labels_sample = labels

        # PCA Projection (2D)
        if viz_sample.shape[1] > 1:
            pca = PCA(n_components=2)
            coords = pca.fit_transform(viz_sample)
        else:
            # Fallback if dataset only has 1 column
            coords = np.column_stack((viz_sample.values, np.zeros(len(viz_sample))))

        # Format for Frontend (Recharts)
        scatter_data = []
        for i in range(len(coords)):
            scatter_data.append({
                "x": float(coords[i][0]),
                "y": float(coords[i][1]),
                "cluster": int(labels_sample[i])
            })
    except Exception as e:
        print(f"[ERROR] PCA Visualization failed: {e}")
        scatter_data = []
        
    return {
        "type": "chart",
        "chartType": "scatter",
        "data": scatter_data,
        "metrics": metrics 
    }