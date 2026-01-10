import pandas as pd
import numpy as np

def apply(df: pd.DataFrame):
    if df.shape[1] < 2:
        return df
        
    X = df.iloc[:, :-1]
    y = df.iloc[:, -1]
    
    X_numeric = X.select_dtypes(include=['number'])
    
    # 1. Find skewed columns (skewness > 1 or < -1)
    skewness = X_numeric.skew()
    skewed_cols = skewness[skewness.abs() > 1].index
    
    if len(skewed_cols) == 0:
        return df # No skewed columns found

    print(f"Log Transform: Applying to {list(skewed_cols)}")
    
    # Make a copy to modify
    X_transformed = X.copy()
    
    for col in skewed_cols:
        # 2. Only apply if all values are non-negative
        if (X_transformed[col] >= 0).all():
            # 3. Use log1p (log(1+x)) to handle zero values
            X_transformed[col] = np.log1p(X_transformed[col])
        else:
            print(f"Log Transform: Skipping '{col}', contains negative values.")
            
    # Re-attach target
    X_transformed[y.name] = y
    return X_transformed