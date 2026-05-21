import pandas as pd
import os
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

# ===============================
# LOAD DATASET (FIX PATH IF NEEDED)
# ===============================
df = pd.read_csv("IndianCrop.csv")

# ===============================
# CLEAN DATA (FIX 'N' STRING ERROR)
# ===============================
df = df[pd.to_numeric(df["N"], errors="coerce").notnull()]

cols = ["N","P","K","temperature","humidity","ph","rainfall"]

# Convert to float
df[cols] = df[cols].astype(float)

df = df.reset_index(drop=True)

# ===============================
# FEATURES & LABEL
# ===============================
X = df[cols]
y = df["label"]

# Encode labels
label_map = {label: i for i, label in enumerate(y.unique())}
reverse_map = {i: label for label, i in label_map.items()}
y_encoded = y.map(label_map)

# ===============================
# TRAIN / TEST SPLIT
# ===============================
X_train, X_test, y_train, y_test = train_test_split(
    X, y_encoded, test_size=0.2, random_state=42
)

# ===============================
# MODEL (WITH PROGRESS)
# ===============================
model = RandomForestClassifier(
    n_estimators=1,
    warm_start=True,
    random_state=42
)

print("\n🚀 Training Started...\n")

for i in range(1, 51):
    model.n_estimators = i
    model.fit(X_train, y_train)

    train_acc = model.score(X_train, y_train)
    test_acc = model.score(X_test, y_test)

    print(f"🌱 Epoch {i}/50 → Train: {train_acc:.4f} | Test: {test_acc:.4f}")

# ===============================
# SAVE MODEL (FIX DIRECTORY ERROR)
# ===============================
os.makedirs("ml", exist_ok=True)

joblib.dump({
    "model": model,
    "reverse_map": reverse_map
}, "ml/model.pkl")

print("\n✅ Model saved at ml/model.pkl")