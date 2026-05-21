from flask import Flask, request, jsonify
import joblib
import numpy as np

app = Flask(__name__)

# ===============================
# LOAD MODEL
# ===============================
try:
    data = joblib.load("model.pkl")
    model = data["model"]
    reverse_map = data["reverse_map"]
    print("✅ Model loaded successfully")
except Exception as e:
    print("❌ Error loading model:", str(e))
    model = None

# ===============================
# HEALTH CHECK
# ===============================
@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "running",
        "message": "Crop Prediction API is live"
    })

# ===============================
# PREDICTION ROUTE
# ===============================
@app.route("/predict", methods=["POST"])
def predict():
    try:
        if model is None:
            return jsonify({"error": "Model not loaded"}), 500

        data = request.json

        if not data or "data" not in data:
            return jsonify({"error": "Missing input data"}), 400

        values = data["data"]

        # Validate input
        if not isinstance(values, list) or len(values) != 7:
            return jsonify({
                "error": "Input must be a list of 7 values [N,P,K,temp,humidity,ph,rainfall]"
            }), 400

        # Convert to numpy
        X = np.array(values).reshape(1, -1)

        # Prediction
        pred = model.predict(X)[0]
        probs = model.predict_proba(X)[0]

        # Top 3 crops
        top3 = sorted(
            [(reverse_map[i], float(probs[i])) for i in range(len(probs))],
            key=lambda x: x[1],
            reverse=True
        )[:3]

        # Confidence
        confidence = round(top3[0][1], 3)

        return jsonify({
            "prediction": reverse_map[int(pred)],
            "confidence": confidence,
            "top3": [
                {"crop": c[0], "probability": round(c[1], 3)}
                for c in top3
            ]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ===============================
# RUN SERVER
# ===============================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)