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

// CORS - Allow forms to work from anywhere (like Getform.io)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// -------------------------
// ROUTES
// -------------------------

// GET FORM ROUTE
app.get("/forms/:formId", (req, res) => {
  const { formId } = req.params;
  res.send(`
    <!doctype html>
    <html>
      <head>
        <title>Form Endpoint</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          h1 { color: #333; margin-bottom: 20px; }
          p { color: #666; line-height: 1.6; }
          .info {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            border-left: 4px solid #2196f3;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Form Endpoint Ready</h1>
          <div class="info">
            <p><strong>Form ID:</strong> ${formId}</p>
            <p>This endpoint is ready to receive form submissions.</p>
            <p>Use <code>action="/forms/${formId}"</code> and <code>method="POST"</code> in your form.</p>
          </div>
        </div>
      </body>
    </html>
  `);
});

// POST FORM ROUTE
// -------------------------
app.post("/forms/:formId", async (req, res) => {
  const { formId } = req.params;

  if (!formId) {
    return res.status(400).send(`
      <!doctype html>
      <html><body><script>alert('Error: Missing Form ID'); history.back();</script></body></html>
    `);
  }

  if (!db) {
    return res.status(500).send(`
      <!doctype html>
      <html><body><script>alert('Error: Server configuration issue'); history.back();</script></body></html>
    `);
  }

  try {
    const cleanData = {};
    for (let key in req.body) {
      if (req.body[key] !== "" && req.body[key] !== null && req.body[key] !== undefined && key !== "_gotcha") {
        cleanData[key] = req.body[key];
      }
    }

    if (Object.keys(cleanData).length === 0) {
      return res.status(400).send(`
        <!doctype html>
        <html><body><script>alert('Error: No form data received'); history.back();</script></body></html>
      `);
    }

    await db.collection(`forms/${formId}/submissions`).add({
      data: cleanData,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Always return alert message (like Getform.io)
    return res.send(`
      <!doctype html>
      <html>
        <body>
          <script>
            alert('Thank you! Your form was submitted successfully.');
            if (document.referrer) {
              window.location.replace(document.referrer);
            } else {
              history.back();
            }
          </script>
        </body>
      </html>
    `);

  } catch (err) {
    return res.status(500).send(`
      <!doctype html>
      <html><body><script>alert('Error: ${err.message}'); history.back();</script></body></html>
    `);
  }
});

// SERVE REACT IN PRODUCTION

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
  });
} else {
  app.use(
    /^\/(?!api|forms).*/,
    createProxyMiddleware({
      target: "http://localhost:3001",
      changeOrigin: true,
      ws: true,
    })
  );
}

// -------------------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
