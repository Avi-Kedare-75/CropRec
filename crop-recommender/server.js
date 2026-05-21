require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const bodyParser = require("body-parser");

// ❌ REMOVED JS ML MODEL
// const { RandomForestClassifier } = require("ml-random-forest");

const connectDB = require("./src/db");
const authRoutes = require("./src/routes/auth");
const pesticideData = require("./src/pesticides.json");
const districtSoil = require("./src/district_soil.json");
const malwaSoil = require("./src/malwa_soil_points.json");

const yieldRouter = require("./server/yield");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

/* ============================================
   1. CONNECT DATABASE
=============================================== */
connectDB();

/* ============================================
   🔥 PYTHON INTEGRATION (ONLY ADDITION)
=============================================== */
async function predictFromPython(X) {
  try {
    const res = await axios.post("http://localhost:8000/predict", {
      data: X[0]
    });

    return res.data.top3;
  } catch (err) {
    console.error("Python API error:", err.message);
    return [];
  }
}

/* ============================================
   3. DEFAULT SOIL NPK VALUES
=============================================== */
const soilNPK = {
  Alluvial: { N: 80, P: 40, K: 35, ph: 6.8 },
  Black: { N: 100, P: 45, K: 45, ph: 7.2 },
  Red: { N: 60, P: 30, K: 30, ph: 6.2 },
  Laterite: { N: 50, P: 20, K: 25, ph: 5.5 }
};

/* ============================================
   4. GEOLOCATION + WEATHER
=============================================== */
const API_KEY = process.env.API_KEY;

async function geocodeDistrict(name) {
  try {
    const url = `http://api.openweathermap.org/geo/1.0/direct?q=${name}&limit=1&appid=${API_KEY}`;
    const r = await axios.get(url);
    return r.data[0];
  } catch {
    return null;
  }
}

async function fetchWeather(lat, lon) {
  try {
    const r = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
    );

    return {
      temperature: r.data.main.temp,
      humidity: r.data.main.humidity,
      rainfall: r.data.rain?.["1h"] || 40
    };
  } catch {
    return { temperature: 25, humidity: 50, rainfall: 40 };
  }
}

/* ============================================
   5. CALCULATE NPK
=============================================== */
function computeDistrictNPK(soilTypes) {
  let sum = { N: 0, P: 0, K: 0, ph: 0 };
  let total = 0;

  soilTypes.forEach(s => {
    const frac = s.fraction;
    const base = soilNPK[s.soil_type] || soilNPK.Alluvial;

    sum.N += base.N * frac;
    sum.P += base.P * frac;
    sum.K += base.K * frac;
    sum.ph += base.ph * frac;

    total += frac;
  });

  return {
    N: Math.round(sum.N / total),
    P: Math.round(sum.P / total),
    K: Math.round(sum.K / total),
    ph: +(sum.ph / total).toFixed(1)
  };
}

/* ============================================
   7. ROUTE: DISTRICT
=============================================== */
app.post("/predict/district", async (req, res) => {
  const { district } = req.body;

  if (!district) return res.json({ error: "District required" });

  const soilData = districtSoil[district];
  if (!soilData) return res.json({ error: "District not found" });

  const npk = computeDistrictNPK(soilData.soil_types);

  const geo = await geocodeDistrict(district);
  if (!geo) return res.json({ error: "Location not found" });

  const weather = await fetchWeather(geo.lat, geo.lon);

  const X = [[
    npk.N, npk.P, npk.K,
    weather.temperature,
    weather.humidity,
    npk.ph,
    weather.rainfall
  ]];

  const predictions = await predictFromPython(X);

  res.json({
    mode: "district",
    district,
    npk,
    weather,
    top3_crops: predictions
  });
});

/* ============================================
   8. MALWA MAP
=============================================== */
function deg2rad(d) {
  return d * Math.PI / 180;
}

function distanceKm(a, b, c, d) {
  const R = 6371;
  const dLat = deg2rad(c - a);
  const dLon = deg2rad(d - b);

  return R * 2 * Math.atan2(
    Math.sqrt(
      Math.sin(dLat / 2) ** 2 +
      Math.cos(deg2rad(a)) *
      Math.cos(deg2rad(c)) *
      Math.sin(dLon / 2) ** 2
    ),
    Math.sqrt(1 - (
      Math.sin(dLat / 2) ** 2 +
      Math.cos(deg2rad(a)) *
      Math.cos(deg2rad(c)) *
      Math.sin(dLon / 2) ** 2
    ))
  );
}

function nearestMalwa(lat, lon) {
  let best = null, min = Infinity;

  malwaSoil.forEach(p => {
    const d = distanceKm(lat, lon, p.lat, p.lon);
    if (d < min) {
      min = d;
      best = { ...p, distance_km: d.toFixed(2) };
    }
  });

  return best;
}

function isInMalwa(lat, lon) {
  return lat >= 22 && lat <= 24 && lon >= 75 && lon <= 77;
}

function cropAllowed(crop, soil, weather) {
  if (crop === "Mango") {
    if (weather.temperature < 20 || weather.temperature > 38) return false;
    if (soil.K < 30) return false;
    if (soil.ph < 5.5 || soil.ph > 7.5) return false;
  }
  return true;
}

app.post("/predict/malwa-map", async (req, res) => {
  const { lat, lon } = req.body;

  if (lat == null || lon == null)
    return res.json({ error: "lat & lon required" });

  if (!isInMalwa(lat, lon))
    return res.json({ error: "Outside Malwa region" });

  const soil = nearestMalwa(lat, lon);
  const weather = await fetchWeather(lat, lon);

  const X = [[
    soil.N, soil.P, soil.K,
    weather.temperature,
    weather.humidity,
    soil.ph,
    weather.rainfall
  ]];

  let predictions = await predictFromPython(X);

  predictions = predictions.filter(p =>
    cropAllowed(p.crop, soil, weather)
  );

  if (predictions.length === 0) {
    predictions = await predictFromPython(X);
  }

  res.json({
    mode: "map",
    region: "Malwa",
    soil,
    weather,
    top3_crops: predictions
  });
});

/* ============================================
   OTHER ROUTES (UNCHANGED)
=============================================== */
app.post("/pesticide", (req, res) => {
  const { crop } = req.body;
  if (!crop) return res.json({ error: "Crop required" });

  const name = crop.toLowerCase().trim();

  if (!pesticideData[name])
    return res.json({ error: "No pesticide data" });

  // ✅ FIX HERE
  res.json({
    crop: name,
    phases: pesticideData[name]
  });
});
/* ============================================
    13. CROP HEALTH ASSESSMENT ROUTE
*/
const API_KEY2 = process.env.API_KEY2;
const API_URL = "https://crop.kindwise.com/api/v1/identification";

app.post("/Health", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Image required" });
    }

    const base64 = image.split(",")[1];

    const response = await axios.post(
      "https://crop.kindwise.com/api/v1/identification?details=common_names,description,treatment,symptoms",
      {
        images: [base64],
        similar_images: true
      },
      {
        headers: {
          "Api-Key": process.env.API_KEY2,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "API failed" });
  }
});
app.use("/auth", authRoutes);
app.use("/api", yieldRouter);
const nodemailer = require("nodemailer");
app.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;

  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: "All fields required" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,   // your gmail
        pass: process.env.EMAIL_PASS,   // app password
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER, 
      replyTo: email, // so you can reply directly to user
      to: process.env.EMAIL_USER, // your inbox
      subject: `📩 New Contact Message`,
      text: `
Name: ${name}
Email: ${email}

Message:
${message}
      `,
    });

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});
/* ============================================
   START SERVER
=============================================== */
app.listen(5000, () =>
  console.log("🚀 Server running at http://localhost:5000")
);