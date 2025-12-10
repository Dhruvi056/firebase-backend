import admin from "firebase-admin";
import querystring from "querystring";

// ---------------------------------------------
// INIT FIREBASE ADMIN
// ---------------------------------------------
let db;
if (!admin.apps.length) {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

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

// ---------------------------------------------
// PARSE FORM BODY
// ---------------------------------------------
function parseForm(body, contentType) {
  if (!body) return {};
  if (typeof body === "object") return body;

  try {
    return querystring.parse(body);
  } catch {
    return {};
  }
}

// ---------------------------------------------
// HANDLER START
// ---------------------------------------------
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).send("POST only");

  // FORM ID
  const formId = req.query.formId;
  if (!formId) return res.status(400).json({ error: "Missing formId" });

  // PARSE BODY
  const contentType = req.headers["content-type"] || "";
  const formData = parseForm(req.body, contentType);

  if (!formData || Object.keys(formData).length === 0) {
    return res.status(400).json({ error: "No form data received" });
  }

  // CLEAN DATA
  const cleanData = {};
  Object.keys(formData).forEach((key) => {
    const value = formData[key];
    if (key !== "_gotcha" && value !== "" && value !== undefined) {
      cleanData[key] = value;
    }
  });

  // SAVE TO FIREBASE
  await db
    .collection(`forms/${formId}/submissions`)
    .add({
      data: cleanData,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // ---------------------------------------------
  // HTML RESPONSE — SAME PAGE — NO REDIRECT
  // ---------------------------------------------
  if (req.headers.accept?.includes("text/html")) {
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Submitted</title>
        <style>
          .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e8f5e9;
            color: #166534;
            padding: 16px 20px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            box-shadow: 0 6px 18px rgba(0,0,0,0.2);
            z-index: 99999;
          }
        </style>
      </head>
      <body>
        <div class="toast">Form submitted successfully!</div>
      </body>
      </html>
    `);
  }

  // JSON RESPONSE
  return res.status(200).json({
    success: true,
    message: "Form submitted successfully!",
    data: cleanData,
  });
}
