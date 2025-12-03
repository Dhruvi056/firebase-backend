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

    // Check if credentials are set
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      console.log("❌ FIREBASE ERROR: Missing required environment variables");
      console.log("   Please check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your .env file");
    } else {
      // Clean up the private key - handle both \n and actual newlines
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // Remove quotes if present
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
        privateKey = privateKey.slice(1, -1);
      }
      
      // Replace \\n with actual newlines
      privateKey = privateKey.replace(/\\n/g, "\n");
      
      // If it still doesn't have newlines, try to add them at key boundaries
      if (!privateKey.includes("\n") && privateKey.includes("-----")) {
        privateKey = privateKey.replace(/-----BEGIN PRIVATE KEY-----/g, "-----BEGIN PRIVATE KEY-----\n");
        privateKey = privateKey.replace(/-----END PRIVATE KEY-----/g, "\n-----END PRIVATE KEY-----");
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });

      db = admin.firestore();
      console.log("🔥 Firebase Admin Connected Successfully");
    }
  }
} catch (err) {
  console.log("❌ FIREBASE ERROR:", err.message);
  console.log("   Tip: Make sure FIREBASE_PRIVATE_KEY is on a single line with \\n for newlines");
}

// -------------------------
// MIDDLEWARES
// -------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
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

  if (!formId)
    return res.status(400).json({ error: "Missing Form ID" });

  if (!db)
    return res.status(500).json({ error: "Firebase not initialized" });

  try {
    const cleanData = {};

    Object.keys(req.body).forEach((key) => {
      if (key !== "_gotcha" && req.body[key] !== "") {
        cleanData[key] = req.body[key];
      }
    });

    await db
      .collection(`forms/${formId}/submissions`)
      .add({
        data: cleanData,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    const htmlAccepted = req.headers.accept?.includes("text/html");

    if (htmlAccepted) {
      return res.send(`
        <h1>Form Submitted Successfully</h1>
        <p>You will be redirected shortly.</p>
      `);
    }

    return res.json({ success: true, data: cleanData });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// -------------------------
// GET FORM ROUTE
// -------------------------
app.get("/api/f/:formId", (req, res) => {
  res.send(`
    <h1>POST only</h1>
    <p>Use this endpoint inside HTML form</p>
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

// -------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running: http://localhost:${PORT}`);
});
