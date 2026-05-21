async function recommendCrop() {
    const soilText = document.getElementById("soilInput").value.trim();
    let soil = {};

    // Parse soil text: N:20, P:30, K:40, ph:6.5, temperature:25, humidity:70, rainfall:120
    function parseSoil(text) {
        const obj = {};
        const parts = text.split(",");
        parts.forEach(p => {
            const [key, val] = p.split(/[:=]/);
            if (!key || !val) return;
            const k = key.trim().toLowerCase();
            const v = Number(val.trim());

            if (k.startsWith("n")) obj.N = v;
            else if (k.startsWith("p") && k !== "ph") obj.P = v;
            else if (k.startsWith("k")) obj.K = v;
            else if (k === "ph") obj.ph = v;
            else if (k.includes("temp")) obj.temperature = v;
            else if (k.includes("humid")) obj.humidity = v;
            else if (k.includes("rain")) obj.rainfall = v;
        });
        return obj;
    }

    soil = parseSoil(soilText);

    // Show loading
    const box = document.getElementById("resultBox");
    box.classList.remove("hidden");
    box.innerHTML = `
        <div class="flex flex-col items-center">
            <div class="spinner"></div>
            <p class="mt-3 text-green-700 font-semibold text-lg">Predicting crop...</p>
        </div>
    `;

    try {
        const response = await fetch("http://localhost:5000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ soil })
        });

        const result = await response.json();

        if (!response.ok) {
            box.innerHTML = `<p class='text-red-600'>❌ ${result.error}</p>`;
            return;
        }

        // Display one crop result
        box.innerHTML = `
            <div class="w-full p-6 rounded-xl bg-green-50 border border-green-300 shadow-md animate-fadeIn text-center">
                <h4 class="text-2xl font-extrabold text-green-700 mb-2">
                    🌱 Recommended Crop:
                </h4>
                <p class="text-3xl font-semibold text-green-900 capitalize mt-2">
                    ${result.crop}
                </p>
            </div>
        `;

    } catch (err) {
        box.innerHTML = `<p class='text-red-600'>❌ Error connecting to server</p>`;
    }
}
