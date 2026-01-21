require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const path = require("path");


const app = express();
const PORT = process.env.PORT || 3000;

let db;

if (!admin.apps.length) {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    // Replace escaped newlines (\\n) with actual newlines (\n)
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });

  db = admin.firestore();
  console.log("Firebase Admin Initialized");
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Access-Control-Expose-Headers", "Content-Type");
  // Add cache control to ensure request shows in network tab
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// -------------------------
// POST FORM ROUTE
// -------------------------
app.post("/api/forms/:formId", async (req, res) => {
  const { formId } = req.params;

  if (!formId) {
    return res.status(400).json({ error: "Missing Form ID" });
  }

  if (!db) {
    return res.status(500).json({ error: "Firebase not initialized" });
  }

  try {
    const cleanData = {};

    for (let key in req.body) {
      if (req.body[key] !== "" && key !== "_gotcha") {
        cleanData[key] = req.body[key];
      }
    }

    if (Object.keys(cleanData).length === 0) {
      return res.status(400).json({ error: "No form data received" });
    }

    await db.collection(`forms/${formId}/submissions`).add({
      data: cleanData,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const acceptsHtml = req.headers.accept?.includes("text/html");
if (req.headers.accept?.includes("text/html")) {
  const referer = req.headers.referer || "/";

  return res.send(`
    <!doctype html>
    <html>
      <body>
        <script>
          const url = new URL("${referer}", window.location.origin);
          url.searchParams.set("form", "success");
          window.location.replace(url.toString());
        </script>
      </body>
    </html>
  `);
}


    return res.json({ success: true, message: "Form submitted successfully", data: cleanData });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// SERVE REACT IN PRODUCTION

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
  });
} 

// -------------------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
