const fs = require("fs");
const csv = require("csv-parser");

function loadDataset() {
    return new Promise((resolve) => {
        const rows = [];
        fs.createReadStream("crop_recommendation.csv")
            .pipe(csv())
            .on("data", (row) => rows.push(row))
            .on("end", () => resolve(rows));
    });
}

module.exports = { loadDataset };
