import os
import joblib
import pandas as pd
import numpy as np

# Make H2O Optional to prevent crashes on systems without it
try:
    import h2o
    H2O_AVAILABLE = True
except ImportError:
    h2o = None
    H2O_AVAILABLE = False

def load_model_and_predict(model_path, dataset_path):
    """
    Universal loader for both Scikit-Learn (.pkl) and H2O models.
    Returns:
        df (pd.DataFrame): The dataset
        labels (np.array): The cluster labels for every row
    """
    
    # 1. Load Data
    df = pd.read_csv(dataset_path)
    # Select numeric columns only for prediction
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
            raise Exception(f"Model file not found at: {model_path}.")
        
        # 1. Try standard .predict()
        if hasattr(model, "predict"):
            try:
                labels = model.predict(df_numeric)
            except:
                # Retry with fit_predict if dimension mismatch
                labels = model.fit_predict(df_numeric)

        # 2. Handle Models without .predict() (DBSCAN, Hierarchical)
        elif hasattr(model, "fit_predict"):
            labels = model.fit_predict(df_numeric)
            
        # 3. Last Resort: Use stored labels
        elif hasattr(model, "labels_"):
            if len(model.labels_) == len(df):
                labels = model.labels_
            else:
                # If sizes differ (e.g. trained on sample), we can't map labels easily
                # Return dummy labels to prevent crash, or raise error
                print("[WARNING] Model labels size mismatch. Returning zeros.")
                labels = np.zeros(len(df))
        else:
            raise Exception("Unknown Scikit-Learn model type.")
            
        return df, labels

    # ==========================================
    # CASE B: H2O Model (Folder or No Extension)
    # ==========================================
    else:
        if not H2O_AVAILABLE:
            raise ImportError("H2O format detected but 'h2o' library is not installed.")

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
            if os.path.isdir(model_path):
                print("   [Loader] Searching directory for binary...")
                files = os.listdir(model_path)
                valid_files = [f for f in files if not f.startswith('.')]
                
                if len(valid_files) > 0:
                    new_path = os.path.join(model_path, valid_files[0])
                    model = h2o.load_model(new_path)
                else:
                    raise Exception(f"H2O directory empty: {model_path}")
            else:
                raise e
        
        # Predict
        preds = model.predict(hf).as_data_frame()
        return df, preds['predict'].values