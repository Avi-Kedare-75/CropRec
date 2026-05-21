const { predictCrop } = require("./src/predict");

console.log("\nTesting Prediction...\n");

const sample = {
    N: 10,
    P: 10,
    K: 40,
    temperature: 25.5,
    humidity: 60,
    ph: 7.5,
    rainfall: 120
};

const crop = predictCrop(sample);

console.log("Recommended Crop:", crop);
