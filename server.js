require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------
// INIT FIREBASE ADMIN
// -------------------------
let db;

try {
  if (!admin.apps.length) {
    console.log("Initializing Firebase Admin...");

    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL ||
      !process.env.FIREBASE_PRIVATE_KEY
    ) {
      console.log("❌ Missing Firebase env variables");
    } else {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (
        (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
        (privateKey.startsWith("'") && privateKey.endsWith("'"))
      ) {
        privateKey = privateKey.slice(1, -1);
      }

      privateKey = privateKey.replace(/\\n/g, "\n").trim();

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });

      db = admin.firestore();
      console.log("🔥 Firebase Admin Connected Successfully");
    }
  }
} catch (err) {
  console.error("❌ Firebase Error:", err.message);
}

// -------------------------
// MIDDLEWARES
// -------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// -------------------------
// POST FORM ROUTE (NO HTML RESPONSE)
// -------------------------
app.post("/api/f/:formId", async (req, res) => {
  const { formId } = req.params;

  if (!formId) return res.status(400).json({ error: "Missing Form ID" });
  if (!db) return res.status(500).json({ error: "Firebase not initialized" });

  try {
    const cleanData = {};

    Object.keys(req.body || {}).forEach((key) => {
      if (
        key !== "_gotcha" &&
        req.body[key] !== "" &&
        req.body[key] !== undefined &&
        req.body[key] !== null
      ) {
        cleanData[key] = req.body[key];
      }
    });

    if (Object.keys(cleanData).length === 0) {
      return res.status(400).json({
        error: "No form data received",
      });
    }

    const docRef = await db
      .collection(`forms/${formId}/submissions`)
      .add({
        data: cleanData,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    console.log("Saved form submission:", docRef.id);

    // ONLY JSON — NO HTML PAGE, NO REDIRECT
    return res.json({
      success: true,
      message: "Form submitted successfully!",
      data: cleanData,
    });

  } catch (err) {
    console.error("❌ Error:", err);

    return res.status(500).json({ error: err.message });
  }
});


// GET ROUTE
app.get("/api/f/:formId", (req, res) => {
  res.send("POST only. Use this endpoint inside an HTML form.");
});


// SERVE REACT APP IN PRODUCTION

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
  });
} else {
  app.use(
    /^\/(?!api).*/,
    createProxyMiddleware({
      target: "http://localhost:3001",
      changeOrigin: true,
      ws: true,
    })
  );
}

// -------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
