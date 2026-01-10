import sys
import os

# Import utils
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)
from model_utils import load_model_and_predict

def run(dataset_path, model_path):
    # Hybrid Load
    df, labels = load_model_and_predict(model_path, dataset_path)
    
    # Attach Labels
    df['Cluster_ID'] = labels
    
    # Save
    output_filename = "labeled_output.csv"
    output_full_path = os.path.join(os.path.dirname(dataset_path), output_filename)
    
    df.to_csv(output_full_path, index=False)
    
    return {
        "type": "file_download",
        "filename": output_filename,
        "path": output_full_path,
        "message": "Dataset with Cluster IDs generated."
    }