import pandas as pd
from sklearn.preprocessing import MinMaxScaler

def apply(df: pd.DataFrame):
    numeric = df.select_dtypes(include=['number']).columns
    scaler = MinMaxScaler()
    df[numeric] = scaler.fit_transform(df[numeric])
    return df
