import pandas as pd

def apply(df: pd.DataFrame):
    return df.drop_duplicates()
