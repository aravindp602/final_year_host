import pandas as pd
from sklearn.preprocessing import StandardScaler

def apply(df: pd.DataFrame):
    numeric = df.select_dtypes(include=['number']).columns
    scaler = StandardScaler()
    df[numeric] = scaler.fit_transform(df[numeric])
    return df
