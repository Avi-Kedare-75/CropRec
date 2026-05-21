const { RandomForestClassifier } = require("ml-random-forest");

function createCropModel() {
   const options = {
    nEstimators: 50,
    maxDepth: 10,
    replacement: true,
    seed: 42
};

    const model = new RandomForestClassifier(options);
    return model;
}

module.exports = { createCropModel };
