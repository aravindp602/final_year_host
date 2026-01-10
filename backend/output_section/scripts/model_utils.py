import os
import joblib
import pandas as pd
import numpy as np
import h2o

def load_model_and_predict(model_path, dataset_path):
    """
    Universal loader for both Scikit-Learn (.pkl) and H2O models.
    Returns:
        df (pd.DataFrame): The dataset
        labels (np.array): The cluster labels for every row
    """
    
    # 1. Load Data (Pandas is used for both for consistency in output generation)
    df = pd.read_csv(dataset_path)
    # Select numeric columns only for prediction (avoids string errors)
    df_numeric = df.select_dtypes(include=[np.number]).fillna(0)

    print(f"   [Loader] Loading model from: {model_path}")

    # ==========================================
    # CASE A: Scikit-Learn Model (.pkl)
    # ==========================================
    if model_path.endswith(".pkl"):
        print("   [Loader] Detected Scikit-Learn format.")
        try:
            model = joblib.load(model_path)
        except FileNotFoundError:
            raise Exception(f"Model file not found at: {model_path}. Did the training save correctly?")
        
        # 1. Try standard .predict() (KMeans, GMM)
        if hasattr(model, "predict"):
            try:
                labels = model.predict(df_numeric)
            except:
                # Retry with fit_predict if predict fails on dimension mismatch
                labels = model.fit_predict(df_numeric)

        # 2. Handle Models without .predict() (DBSCAN, Hierarchical)
        elif hasattr(model, "fit_predict"):
            labels = model.fit_predict(df_numeric)
            
        # 3. Last Resort: Use stored labels if size matches exactly
        elif hasattr(model, "labels_"):
            if len(model.labels_) == len(df):
                labels = model.labels_
            else:
                raise Exception("Model structure does not support prediction on new data.")
        else:
            raise Exception("Unknown Scikit-Learn model type.")
            
        return df, labels

    # ==========================================
    # CASE B: H2O Model (No extension or Directory)
    # ==========================================
    else:
        print("   [Loader] Detected H2O format.")
        try:
            h2o.init(check_version=False)
        except:
            h2o.init()
            
        # Load H2O Frame
        hf = h2o.import_file(dataset_path)
        
        # Load H2O Model with Fallback Logic
        try:
            model = h2o.load_model(model_path)
        except Exception as e:
            print(f"   [Loader] Direct load failed: {e}")
            # Fallback: Maybe it's a directory and the binary is inside?
            if os.path.isdir(model_path):
                print("   [Loader] Path is a directory, searching for model binary...")
                files = os.listdir(model_path)
                # Filter out hidden files or common system files
                valid_files = [f for f in files if not f.startswith('.')]
                
                if len(valid_files) > 0:
                    # Try loading the first valid file in the directory
                    new_path = os.path.join(model_path, valid_files[0])
                    print(f"   [Loader] Trying inner file: {new_path}")
                    model = h2o.load_model(new_path)
                else:
                    raise Exception(f"H2O model directory is empty: {model_path}")
            else:
                raise e
        
        # Predict
        preds = model.predict(hf).as_data_frame()
        
        # Return original pandas DF and the 'predict' column
        return df, preds['predict'].values