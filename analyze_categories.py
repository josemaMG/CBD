import pandas as pd
import glob
import os

files = glob.glob("data/Superstore[23].csv")

for file in files:
    print(f"--- Processing {file} ---")
    df = pd.read_csv(file, encoding='latin1')
    
    # Standardize column names to lowercase and replace underscores with spaces/dashes for matching
    cols = {col: col.lower().replace("_", "").replace("-", "") for col in df.columns}
    
    cat_col = next((c for c, l in cols.items() if l == 'category'), None)
    subcat_col = next((c for c, l in cols.items() if l == 'subcategory'), None)
    
    if cat_col and subcat_col:
        summary = df.groupby(cat_col)[subcat_col].unique()
        for cat, subcats in summary.items():
            print(f"Category: {cat} ({len(subcats)} subcategories)")
            print(f"  Subcategories: {', '.join(map(str, subcats))}")
    else:
        print(f"Columns not found in {file}. Found: {list(df.columns)}")
    print()
