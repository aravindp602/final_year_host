import pandas as pd
import numpy as np
from sklearn.preprocessing import KBinsDiscretizer
import warnings

def apply(df: pd.DataFrame):
    if df.shape[1] < 2:
        return df

    # 1. Separate Features and Target
    X = df.iloc[:, :-1]
    y = df.iloc[:, -1]
    
    # 2. Select Numeric Columns
    X_numeric_cols = X.select_dtypes(include=['number']).columns
    
    if len(X_numeric_cols) == 0:
        return df 

    # 3. Drop Constant Columns (Zero Variance)
    # These cause "Feature is constant" warnings and break some models
    constant_cols = [col for col in X_numeric_cols if X[col].nunique() <= 1]
    if constant_cols:
        print(f"Binning: Dropping constant columns: {constant_cols}")
        X = X.drop(columns=constant_cols)
        # Update numeric columns list
        X_numeric_cols = X.select_dtypes(include=['number']).columns

    # 4. Smart Selection: Only bin columns with sufficient unique values
    # If a column has fewer unique values than n_bins, binning is redundant/impossible
    n_bins = 5
    cols_to_bin = [col for col in X_numeric_cols if X[col].nunique() > n_bins]
    cols_skipped = [col for col in X_numeric_cols if col not in cols_to_bin]

    if cols_skipped:
        print(f"Binning: Skipping {len(cols_skipped)} columns (low cardinality, already discrete)")

    if not cols_to_bin:
        print("Binning: No columns suitable for binning after filtering.")
        # Re-attach target and return
        X[y.name] = y
        return X

    print(f"Binning: Applying quantile binning to {len(cols_to_bin)} columns...")

    # 5. Apply Discretizer
    # subsample=200000 improves speed on large datasets while maintaining accuracy
    discretizer = KBinsDiscretizer(n_bins=n_bins, encode='ordinal', strategy='quantile', subsample=200000)
    
    X_binned = X.copy()
    
    # Suppress the specific "Bins whose width are too small" warning that clutters logs
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", message="Bins whose width are too small")
        try:
            X_binned[cols_to_bin] = discretizer.fit_transform(X[cols_to_bin])
        except ValueError:
            # Fallback for extremely skewed distributions where quantile fails
            print("Binning: Quantile strategy failed. Switching to 'uniform' strategy.")
            discretizer = KBinsDiscretizer(n_bins=n_bins, encode='ordinal', strategy='uniform')
            X_binned[cols_to_bin] = discretizer.fit_transform(X[cols_to_bin])
    
    # 6. Re-attach target column
    X_binned[y.name] = y
    
    return X_binned