import admin from "firebase-admin";
import querystring from "querystring";

// --------------------------
// INIT FIREBASE ADMIN
// --------------------------
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

// --------------------------
// PARSE BODY
// --------------------------
function parseForm(body, contentType) {
  if (typeof body === "object") return body;
  if (contentType.includes("application/x-www-form-urlencoded"))
    return querystring.parse(body);
  if (contentType.includes("application/json"))
    return JSON.parse(body || "{}");

  return {};
}

// --------------------------
// HANDLER
// --------------------------
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(400).json({ error: "POST only" });

  const formId = req.query.formId;
  if (!formId) return res.status(400).json({ error: "Missing formId" });

  const contentType = req.headers["content-type"] || "";
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  const formData = parseForm(raw, contentType);

  const cleanData = {};
  Object.keys(formData).forEach((k) => {
    if (formData[k]) cleanData[k] = formData[k];
  });

  await db.collection(`forms/${formId}/submissions`).add({
    data: cleanData,
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // ⭐ ONLY JSON — NO HTML PAGE
  return res.json({
    success: true,
    message: "Form submitted successfully!",
    data: cleanData,
  });
}
