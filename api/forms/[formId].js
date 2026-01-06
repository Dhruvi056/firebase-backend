import admin from "firebase-admin";
import querystring from "querystring";


// Initialize Firebase

let db;
if (!admin.apps.length) {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });

  db = admin.firestore();
} else {
  db = admin.firestore();
}


// Helper: Parse Body
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


// Main Handler
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
    // 1️ Parse Form Body
    const formData = parseBody(req);

    if (!formData || Object.keys(formData).length === 0) {
      return res.status(400).json({
        error: "No form data received",
      });
    }

    // 2️ Clean empty fields
    const cleanData = {};
    for (let key in formData) {
      if (formData[key] !== "" && formData[key] !== null) {
        cleanData[key] = formData[key];
      }
    }

    // 3️ Save to Firestore
    await db.collection(`forms/${formId}/submissions`).add({
      data: cleanData,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4️ Response
    const acceptsHtml = req.headers.accept?.includes("text/html");

    if (acceptsHtml) {
      // Show an alert and return to the previous page so the user never leaves
      return res.status(200).send(`
        <!doctype html>
        <html>
          <body>
            <script>
              alert('Thank you! Your form was submitted.');
              if (document.referrer) {
                window.location.replace(document.referrer);
              } else {
                history.back();
              }
            </script>
          </body>
        </html>
      `);
    }

    return res.status(200).json({
      success: true,
      message: "Form submitted successfully",
      data: cleanData,
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      message: error.message,
    });
  }
}

