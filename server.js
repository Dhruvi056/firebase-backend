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

  console.log("\n=== Form Submission Debug (Local) ===");
  console.log("Method:", req.method);
  console.log("FormId:", formId);
  console.log("Content-Type:", req.headers["content-type"]);
  console.log("req.body:", JSON.stringify(req.body, null, 2));
  console.log("req.body type:", typeof req.body);
  console.log("req.body keys:", Object.keys(req.body || {}));

  if (!formId)
    return res.status(400).json({ error: "Missing Form ID" });

  if (!db) {
    console.error("❌ Firebase not initialized");
    return res.status(500).json({ error: "Firebase not initialized" });
  }

  try {
    const cleanData = {};

    // Log all body data
    console.log("Processing form data...");
    console.log("Raw req.body:", req.body);

    Object.keys(req.body || {}).forEach((key) => {
      if (key !== "_gotcha" && req.body[key] !== "" && req.body[key] !== undefined && req.body[key] !== null) {
        cleanData[key] = req.body[key];
        console.log(`  - ${key}: ${req.body[key]}`);
      }
    });

    console.log("Clean data to save:", JSON.stringify(cleanData, null, 2));

    if (Object.keys(cleanData).length === 0) {
      console.error("❌ No data to save after cleaning");
      return res.status(400).json({ 
        error: "No form data received",
        debug: {
          bodyType: typeof req.body,
          bodyKeys: Object.keys(req.body || {}),
          bodyContent: req.body
        }
      });
    }

    const docRef = await db
      .collection(`forms/${formId}/submissions`)
      .add({
        data: cleanData,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    console.log("✅ Successfully saved submission with ID:", docRef.id);
    console.log("=== End Debug ===\n");

    const htmlAccepted = req.headers.accept?.includes("text/html");

    if (htmlAccepted) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Form Submitted Successfully</title>
            <meta http-equiv="refresh" content="3;url=${req.headers.referer || '#'}" />
            <style>
              body { 
                font-family: Arial, sans-serif; 
                max-width: 600px; 
                margin: 100px auto; 
                padding: 20px;
                text-align: center;
              }
              .success { 
                color: #2e7d32; 
                background: #e8f5e9; 
                padding: 30px; 
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .success h1 { margin-top: 0; }
              .success p { color: #555; }
            </style>
          </head>
          <body>
            <div class="success">
              <h1>✓ Form Submitted Successfully!</h1>
              <p>Thank you for your submission. You will be redirected in 3 seconds...</p>
            </div>
          </body>
        </html>
      `);
    }

    return res.json({ success: true, data: cleanData });
  } catch (err) {
    console.error("❌ Error submitting form:", err);
    console.error("Error stack:", err.stack);
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
