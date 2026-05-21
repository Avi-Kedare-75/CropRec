const fs = require("fs");
const { RandomForestClassifier } = require("ml-random-forest");

// Load trained model
function loadModel() {
    const data = JSON.parse(fs.readFileSync("trained_model.json", "utf8"));
    const model = RandomForestClassifier.load(data.model);   // load RF model
    const labelMap = data.labelMap;   // numeric → crop mapping

    // Reverse mapping: id → name
    const idToLabel = {};
    for (const crop in labelMap) {
        idToLabel[labelMap[crop]] = crop;
    }

    return { model, idToLabel };
}

// Predict using Random Forest
function predictCrop(input) {
    const { model, idToLabel } = loadModel();

    // Convert input object → array
    const featureArray = [
        input.N,
        input.P,
        input.K,
        input.temperature,
        input.humidity,
        input.ph,
        input.rainfall
    ];

    // Predict numeric label
    const predictionId = model.predict([featureArray])[0];

    // Convert numeric label → crop name
    const predictedCrop = idToLabel[predictionId];

    return predictedCrop;
}

module.exports = { predictCrop };
