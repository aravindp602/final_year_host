import pandas as pd
import numpy as np

def apply(df: pd.DataFrame):
    if df.shape[1] < 2:
        return df # Not enough columns

    # Separate features (X) and target (y)
    X = df.iloc[:, :-1]
    y = df.iloc[:, -1]
    
    # Select only numeric feature columns
    X_numeric = X.select_dtypes(include=[np.number])
    
    if X_numeric.empty:
        return df # No numeric features to check
    
    Q1 = X_numeric.quantile(0.25)
    Q3 = X_numeric.quantile(0.75)
    IQR = Q3 - Q1
    
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR
    
    # Create a boolean mask for all rows that are NOT outliers in ANY column
    # (X_numeric >= lower_bound) gives True/False for each cell
    # .all(axis=1) checks that all values in a row are True (i.e., within bounds)
    mask = ((X_numeric >= lower_bound) & (X_numeric <= upper_bound)).all(axis=1)
    
    # Apply the mask to the original dataframe
    df_cleaned = df[mask]
    
    print(f"Outlier Removal (IQR): Removed {len(df) - len(df_cleaned)} rows.")
    
    return df_cleaned