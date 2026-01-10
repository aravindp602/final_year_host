import pandas as pd

def apply(df: pd.DataFrame):
    cat_cols = df.select_dtypes(include=['object']).columns
    return pd.get_dummies(df, columns=cat_cols, drop_first=True)
