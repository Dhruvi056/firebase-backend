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

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      console.log("❌ Missing Firebase credentials");
    } else {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }

      privateKey = privateKey.replace(/\\n/g, "\n").trim();

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });

      db = admin.firestore();
      console.log("🔥 Firebase Connected");
    }
  }
} catch (err) {
  console.log("❌ Firebase init error:", err);
}

// -------------------------
// MIDDLEWARES
// -------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// -------------------------
// POST FORM ROUTE
// -------------------------
app.post("/api/f/:formId", async (req, res) => {
  const { formId } = req.params;

  if (!formId) return res.status(400).json({ error: "Missing Form ID" });
  if (!db) return res.status(500).json({ error: "Firebase not initialized" });

  try {
    const cleanData = {};

    Object.keys(req.body || {}).forEach((key) => {
      const val = req.body[key];
      if (val !== "" && val !== undefined && key !== "_gotcha") {
        cleanData[key] = val;
      }
    });

    if (Object.keys(cleanData).length === 0) {
      return res.status(400).json({ error: "No form data found" });
    }

    await db
      .collection(`forms/${formId}/submissions`)
      .add({
        data: cleanData,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // -----------------------------
    // SIMPLE TOAST HTML — NO REDIRECT
    // -----------------------------
    if (req.headers.accept?.includes("text/html")) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Success</title>
          <style>
            body {
              font-family: Arial;
              background: #f5f5f5;
            }
            .toast {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #e8f5e9;
              color: #166534;
              padding: 16px 20px;
              border-radius: 8px;
              box-shadow: 0 6px 18px rgba(0,0,0,0.15);
              font-size: 14px;
              z-index: 9999;
            }
          </style>
        </head>
        <body>
          <div class="toast">Form submitted successfully!</div>
        </body>
        </html>
      `);
    }

    return res.json({
      success: true,
      message: "Form submitted successfully!",
      data: cleanData,
    });

  } catch (err) {
    console.error("❌ Error:", err);

    if (req.headers.accept?.includes("text/html")) {
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error</title>
          <style>
            .toast {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #fee2e2;
              color: #991b1b;
              padding: 16px 20px;
              border-radius: 8px;
              box-shadow: 0 6px 18px rgba(0,0,0,0.15);
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="toast">Error: ${err.message}</div>
        </body>
        </html>
      `);
    }

    return res.status(500).json({ error: err.message });
  }
});

// -------------------------
// GET ROUTE
// -------------------------
app.get("/api/f/:formId", (req, res) => {
  res.send(`
    <h1>POST only</h1>
    <p>Use this endpoint inside an HTML form.</p>
  `);
});

// -------------------------
// SERVE REACT IN PRODUCTION
// -------------------------
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

app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));
