import admin from "firebase-admin";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  } catch (error) {
    console.error("Firebase Admin initialization error", error);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Prevent browser GET redirect
  if (req.method !== "POST") {
    return res.status(200).json({
      success: false,
      message: "This endpoint only accepts POST requests.",
      tip: "Do not open this URL directly in browser."
    });
  }

  const { formId } = req.query;

  if (!formId) {
    return res.status(400).json({ error: "Missing formId" });
  }

  try {
    let body = {};

    // Parse form-data manually
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const formData = Buffer.concat(chunks).toString();

    formData.split("&").forEach((pair) => {
      const [key, value] = pair.split("=");
      if (key) {
        body[decodeURIComponent(key)] = decodeURIComponent(value || "");
      }
    });

    // Use Firebase Admin SDK to write to Firestore
    const submissionsRef = db.collection(`forms/${formId}/submissions`);
    await submissionsRef.add({
      data: body,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "Form submitted successfully!",
      data: body,
    });

  } catch (e) {
    console.error("Error submitting form:", e);
    return res.status(500).json({ 
      error: "Server error",
      message: e.message 
    });
  }
}
