import pandas as pd
from sklearn.decomposition import PCA

def apply(df: pd.DataFrame):
    numeric = df.select_dtypes(include=['number']).columns
    pca = PCA(n_components=min(5, len(numeric)))
    pca_result = pca.fit_transform(df[numeric])
    for i in range(pca_result.shape[1]):
        df[f"PCA_{i+1}"] = pca_result[:, i]
    return df
