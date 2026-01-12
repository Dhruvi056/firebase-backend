import admin from "firebase-admin";
import querystring from "querystring";

let db;
if (!admin.apps.length) {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    // Handle different escape formats (Vercel environment variables)
    // Replace escaped newlines with actual newlines
    privateKey = privateKey.replace(/\\n/g, "\n");
    // Also handle if it's already a string with literal \n
    privateKey = privateKey.replace(/\\\\n/g, "\n");
    // Remove quotes if present
    privateKey = privateKey.replace(/^["']|["']$/g, "");
  }

  if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error("Missing Firebase configuration");
    throw new Error("Firebase configuration is incomplete");
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });

    db = admin.firestore();
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error.message);
    throw error;
  }
} else {
  db = admin.firestore();
}

// ---------------------
// Helper: Parse Body
// ---------------------
function parseBody(req) {
  const contentType = req.headers["content-type"] || "";

  if (contentType.includes("application/json")) {
    return req.body;
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    if (typeof req.body === "string") {
      return querystring.parse(req.body);
    }
    return req.body;
  }

  return {};
}

// ---------------------
// Main Handler
// ---------------------
export default async function handler(req, res) {

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests allowed" });
  }

  const formId = req.query.formId;
  if (!formId) {
    return res.status(400).json({ error: "Missing formId" });
  }

  if (!db) {
    return res.status(500).json({
      error: "Firebase not initialized",
    });
  }

  try {
    //  Parse Form Body
    const formData = parseBody(req);

    if (!formData || Object.keys(formData).length === 0) {
      return res.status(400).json({
        error: "No form data received",
      });
    }

    //  Clean empty fields and filter out Cloudflare Turnstile response
    const cleanData = {};
    for (let key in formData) {
      // Skip Cloudflare Turnstile response field
      if (key === 'cf-turnstile-response') {
        continue;
      }
      if (formData[key] !== "" && formData[key] !== null) {
        cleanData[key] = formData[key];
      }
    }

    //  Save to Firestore
    await db.collection(`forms/${formId}/submissions`).add({
      data: cleanData,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    //  Response
    return res.status(200).json({
      success: true,
      message: "Form submitted successfully",
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      message: error.message,
    });
  }
}
