const fs = require("fs");
const { RandomForestClassifier } = require("ml-random-forest");
const csv = require("csv-parser");

function loadCSV(path) {
    return new Promise((resolve, reject) => {
        const rows = [];
        console.log("📂 Loading CSV...");
        fs.createReadStream(path)
            .pipe(csv())
            .on("data", (data) => rows.push(data))
            .on("end", () => {
                console.log("✅ CSV loaded successfully!");
                console.log("📊 Rows:", rows.length);
                resolve(rows);
            })
            .on("error", (err) => {
                console.log("❌ CSV load error:", err);
                reject(err);
            });
    });
}

async function trainModel() {
    console.log("🔄 Starting training...");

    const dataset = await loadCSV("crop_recommendation.csv");

    const features = [];
    const labels = [];

    const labelMap = {};
    let nextId = 0;

    dataset.forEach(row => {
        const arr = [
            Number(row.N),
            Number(row.P),
            Number(row.K),
            Number(row.temperature),
            Number(row.humidity),
            Number(row.ph),
            Number(row.rainfall)
        ];

        const crop = row.label.trim();

        if (!labelMap.hasOwnProperty(crop)) {
            labelMap[crop] = nextId++;
        }

        features.push(arr);
        labels.push(labelMap[crop]);
    });

    console.log("🌲 Initializing Random Forest with probability enabled...");

    const options = {
    seed: 42,
    nEstimators: 20,   // ← VERY IMPORTANT
    maxFeatures: 0.8,
    replacement: true,
    useSampleBagging: true,
    probability: true
};


    const rf = new RandomForestClassifier(options);

    console.log("🚀 Training model...");
    rf.train(features, labels);
    console.log("🎉 Training complete!");

    fs.writeFileSync("trained_model.json", JSON.stringify({
        model: rf.toJSON(),
        labelMap
    }, null, 2));

    console.log("💾 Model saved → trained_model.json");
    console.log("✔ Done!");
}

trainModel();
