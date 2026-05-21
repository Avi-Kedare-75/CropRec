// server/yield.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Load district soil mappings
const districtSoil = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "src", "district_soil.json"), "utf8")
);

/* ============================================
   FIXED + EXTENDED CROP BASELINE
=============================================== */
const CROP_BASELINE = {
  rice: { baseline: 3.5, opt_rainfall: 1200, opt_temp: 25, opt_N: 90, opt_P: 40, opt_K: 40, opt_ph: 6.5 },
  wheat: { baseline: 3.0, opt_rainfall: 500, opt_temp: 20, opt_N: 80, opt_P: 40, opt_K: 40, opt_ph: 6.5 },
  maize: { baseline: 2.8, opt_rainfall: 600, opt_temp: 22, opt_N: 70, opt_P: 35, opt_K: 30, opt_ph: 6.5 },
  barley: { baseline: 2.5, opt_rainfall: 500, opt_temp: 18, opt_N: 60, opt_P: 30, opt_K: 30, opt_ph: 6.5 },
  sorghum: { baseline: 2.2, opt_rainfall: 600, opt_temp: 28, opt_N: 60, opt_P: 30, opt_K: 30, opt_ph: 6.5 },

  chickpea: { baseline: 1.1, opt_rainfall: 400, opt_temp: 20, opt_N: 20, opt_P: 20, opt_K: 20, opt_ph: 6.5 },
  pigeon_pea: { baseline: 1.0, opt_rainfall: 600, opt_temp: 25, opt_N: 30, opt_P: 30, opt_K: 30, opt_ph: 6.5 },
  green_gram: { baseline: 0.9, opt_rainfall: 400, opt_temp: 27, opt_N: 20, opt_P: 20, opt_K: 20, opt_ph: 6.5 },
  black_gram: { baseline: 0.9, opt_rainfall: 400, opt_temp: 27, opt_N: 20, opt_P: 20, opt_K: 20, opt_ph: 6.5 },
  lentil: { baseline: 0.9, opt_rainfall: 450, opt_temp: 18, opt_N: 20, opt_P: 20, opt_K: 20, opt_ph: 6.0 },

  mustard: { baseline: 1.2, opt_rainfall: 500, opt_temp: 20, opt_N: 60, opt_P: 30, opt_K: 30, opt_ph: 6.5 },
  groundnut: { baseline: 1.5, opt_rainfall: 700, opt_temp: 25, opt_N: 50, opt_P: 30, opt_K: 30, opt_ph: 6.5 },
  soybean: { baseline: 2.0, opt_rainfall: 800, opt_temp: 25, opt_N: 60, opt_P: 30, opt_K: 30, opt_ph: 6.5 },
  sunflower: { baseline: 1.4, opt_rainfall: 600, opt_temp: 25, opt_N: 60, opt_P: 30, opt_K: 40, opt_ph: 6.5 },

  cotton: { baseline: 1.6, opt_rainfall: 700, opt_temp: 26, opt_N: 60, opt_P: 25, opt_K: 40, opt_ph: 6.2 },
  sugarcane: { baseline: 70, opt_rainfall: 1500, opt_temp: 28, opt_N: 150, opt_P: 60, opt_K: 100, opt_ph: 6.5 },

  potato: { baseline: 25, opt_rainfall: 600, opt_temp: 18, opt_N: 120, opt_P: 60, opt_K: 100, opt_ph: 6.0 },
  onion: { baseline: 20, opt_rainfall: 500, opt_temp: 20, opt_N: 100, opt_P: 50, opt_K: 80, opt_ph: 6.5 },
  tomato: { baseline: 30, opt_rainfall: 600, opt_temp: 22, opt_N: 120, opt_P: 60, opt_K: 100, opt_ph: 6.5 },

  tea: { baseline: 2.5, opt_rainfall: 2000, opt_temp: 22, opt_N: 100, opt_P: 50, opt_K: 100, opt_ph: 5.5 },

  // 🔥 Coffee fixed
  coffee: { baseline: 2.0, opt_rainfall: 1500, opt_temp: 20, opt_N: 80, opt_P: 40, opt_K: 80, opt_ph: 5.8 }
};

/* ============================================
   SOIL DEFAULTS
=============================================== */
const soilNPK = {
  Alluvial: { N: 80, P: 40, K: 35, ph: 6.8 },
  Black: { N: 100, P: 45, K: 45, ph: 7.2 },
  Red: { N: 60, P: 30, K: 30, ph: 6.2 },
  Laterite: { N: 50, P: 20, K: 25, ph: 5.5 },
  Coastal: { N: 20, P: 15, K: 18, ph: 7.4 }
};

const OPENWEATHER_KEY = process.env.API_KEY;

/* ============================================
   HELPERS
=============================================== */
function computeDistrictNPK(soilList) {
  let total = 0;
  let avg = { N: 0, P: 0, K: 0, ph: 0 };

  soilList.forEach(s => {
    const base = soilNPK[s.soil_type] || soilNPK.Alluvial;

    avg.N += base.N * s.fraction;
    avg.P += base.P * s.fraction;
    avg.K += base.K * s.fraction;
    avg.ph += base.ph * s.fraction;

    total += s.fraction;
  });

  return {
    N: Math.round(avg.N / total),
    P: Math.round(avg.P / total),
    K: Math.round(avg.K / total),
    ph: +(avg.ph / total).toFixed(1)
  };
}

async function fetchWeather(district) {
  try {
    const geo = await axios.get(
      `http://api.openweathermap.org/geo/1.0/direct?q=${district}&limit=1&appid=${OPENWEATHER_KEY}`
    );

    if (!geo.data[0]) return null;

    const { lat, lon } = geo.data[0];

    const weather = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_KEY}`
    );

    return {
      temperature: weather.data.main.temp,
      humidity: weather.data.main.humidity,
      rainfall: weather.data.rain?.["1h"] || 50
    };

  } catch {
    return null;
  }
}

/* ============================================
   FIXED YIELD CALCULATION
=============================================== */
function calculateYield(crop, npk, weather) {
  // 🔥 FIX: normalize crop name
  crop = crop.toLowerCase().replace(/\s+/g, "_");

  const base = CROP_BASELINE[crop];
  if (!base) return { error: "Crop not supported" };

  const RF = weather.rainfall / base.opt_rainfall;
  const TF = weather.temperature / base.opt_temp;

  const N = npk.N / base.opt_N;
  const P = npk.P / base.opt_P;
  const K = npk.K / base.opt_K;

  const npkFactor = (N + P + K) / 3;

  const predicted =
    base.baseline *
    Math.max(0.6, RF) *
    Math.max(0.6, TF) *
    Math.max(0.6, npkFactor);

  return {
    crop,
    yield: +predicted.toFixed(2),
    npk,
    weather
  };
}

/* ============================================
   ROUTE
=============================================== */
router.post("/predict-yield", async (req, res) => {
  try {
    const { crop, district } = req.body;

    if (!crop || !district)
      return res.status(400).json({ error: "crop and district are required" });

    const soil = districtSoil[district];
    if (!soil)
      return res.status(400).json({ error: "District not found" });

    const npk = computeDistrictNPK(soil.soil_types);
    const weather = await fetchWeather(district);

    if (!weather)
      return res.status(500).json({ error: "Weather fetch failed" });

    const result = calculateYield(crop, npk, weather);

    return res.json({
      district,
      crop: result.crop,
      yield: result.yield,
      npk,
      weather
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;