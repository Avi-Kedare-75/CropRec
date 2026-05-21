function preprocessData(dataset) {
    // Extract all unique crop names
    const uniqueLabels = [...new Set(dataset.map(row => row.label))];

    // Map crop name → number
    const labelToId = {};
    uniqueLabels.forEach((label, index) => {
        labelToId[label] = index;
    });

    // Numeric features
    const features = dataset.map(row => ([
        row.N,
        row.P,
        row.K,
        row.temperature,
        row.humidity,
        row.ph,
        row.rainfall
    ]));

    // Convert crop labels to numeric IDs
    const labels = dataset.map(row => labelToId[row.label]);

    return { features, labels, labelToId };
}

module.exports = { preprocessData };
