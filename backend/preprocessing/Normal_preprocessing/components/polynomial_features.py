import pandas as pd
from sklearn.preprocessing import PolynomialFeatures

def apply(df: pd.DataFrame):
    if df.shape[1] < 2:
        return df

    X = df.iloc[:, :-1]
    y = df.iloc[:, -1]
    
    X_numeric = X.select_dtypes(include=['number'])
    X_categorical = X.select_dtypes(exclude=['number'])
    
    if X_numeric.empty:
        return df # No numeric features to combine

    # Create polynomial features (degree 2)
    # include_bias=False skips the '1' (constant) term
    poly = PolynomialFeatures(degree=2, interaction_only=False, include_bias=False)
    X_poly_values = poly.fit_transform(X_numeric)
    
    # Get new feature names
    poly_names = poly.get_feature_names_out(X_numeric.columns)
    
    # Create new dataframe with new features, preserving index
    X_poly_df = pd.DataFrame(X_poly_values, columns=poly_names, index=X.index)
    
    # Combine back: Non-numeric + New Poly Features + Target
    return pd.concat([X_categorical, X_poly_df, y], axis=1)