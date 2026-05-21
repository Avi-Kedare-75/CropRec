const fs = require("fs");
const csv = require("csv-parser");

async function getDataset() {
    const results = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream("crop_recommendation.csv")
            .pipe(csv())
            .on("data", (row) => {
                // convert numeric values from strings
                Object.keys(row).forEach(key => {
                    const num = Number(row[key]);
                    if (!isNaN(num)) row[key] = num;
                });
                results.push(row);
            })
            .on("end", () => {
                console.log("CSV loaded successfully.");
                resolve(results);
            })
            .on("error", reject);
    });
}

module.exports = { getDataset };
