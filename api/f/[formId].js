import admin from "firebase-admin";
import querystring from "querystring";

// Initialize Firebase Admin SDK
let db;
if (!admin.apps.length) {
  try {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      console.error("Missing Firebase Admin environment variables");
    } else {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, "\n");

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });

      db = admin.firestore();
      console.log("Firebase Admin initialized successfully");
    }
  } catch (error) {
    console.error("Firebase Admin initialization error:", error.message);
  }
} else {
  db = admin.firestore();
}

// Parse form body
function parseFormData(body, contentType) {
  const data = {};

  if (contentType?.includes("application/json")) {
    try {
      return typeof body === "string" ? JSON.parse(body) : body;
    } catch (e) {
      console.error("JSON parse error:", e);
      return {};
    }
  } else if (contentType?.includes("application/x-www-form-urlencoded")) {
    if (typeof body === "string") {
      try {
        return querystring.parse(body);
      } catch {
        body.split("&").forEach((pair) => {
          const [key, value = ""] = pair.split("=");
          if (key) data[decodeURIComponent(key)] = decodeURIComponent(value);
        });
      }
    }
    return data;
  } else {
    if (typeof body === "string") {
      try {
        return querystring.parse(body);
      } catch {
        body.split("&").forEach((pair) => {
          const [key, value = ""] = pair.split("=");
          if (key) data[decodeURIComponent(key)] = decodeURIComponent(value);
        });
      }
    }
    return body || {};
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(200).json({
      success: false,
      message: "This endpoint only accepts POST requests.",
    });
  }

  const formId = req.query.formId;
  if (!formId) return res.status(400).json({ error: "Missing formId" });

  if (!db) {
    return res.status(500).json({
      error: "Firebase not initialized",
    });
  }

  try {
    const contentType = req.headers["content-type"] || "";
    let formData = {};
    let rawBody = "";

    // Parse body
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === "object" && Object.keys(req.body).length > 0) {
        formData = req.body;
      } else if (typeof req.body === "string") {
        rawBody = req.body;
        formData = parseFormData(rawBody, contentType);
      }
    }

    if (!formData || Object.keys(formData).length === 0) {
      return res.status(400).json({
        error: "No form data received",
      });
    }

    // Clean data
    const cleanData = {};
    Object.keys(formData).forEach((key) => {
      const value = formData[key];
      if (key && value !== "" && value !== null && value !== undefined) {
        cleanData[key] = Array.isArray(value) ? value.join(", ") : value;
      }
    });

    if (Object.keys(cleanData).length === 0) {
      return res.status(400).json({ error: "No usable form data" });
    }

    // Save to Firestore
    const submissionsRef = db.collection(`forms/${formId}/submissions`);
    await submissionsRef.add({
      data: cleanData,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // If HTML form, return toast page WITHOUT NAVIGATION
    const acceptsHtml = req.headers.accept?.includes("text/html");
    const message = "Form submitted successfully!";

    if (acceptsHtml) {
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Form Submitted</title>
            <style>
              body {
                font-family: Arial;
                background: transparent;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
              }
              .toast {
                background: #e8f5e9;
                color: #166534;
                padding: 16px 20px;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                border-left: 4px solid #4caf50;
                animation: fadeIn 0.3s;
              }
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
              }
            </style>
          </head>
          <body>
            <div class="toast">${message}</div>

            <script>
              // No navigation — only show toast
              setTimeout(() => {
                document.querySelector('.toast').style.opacity = '0';
              }, 3500);
            </script>
          </body>
        </html>
      `);
    }

    // For fetch() users
    return res.status(200).json({
      success: true,
      message,
      data: cleanData,
    });

  } catch (e) {
    return res.status(500).json({
      error: "Server error",
      message: e.message,
    });
  }
}
