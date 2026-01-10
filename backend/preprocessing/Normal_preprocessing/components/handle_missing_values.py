import pandas as pd

def apply(df: pd.DataFrame):
    df = df.fillna(df.mean(numeric_only=True))
    df = df.fillna("Unknown")
    return df
