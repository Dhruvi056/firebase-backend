import { db } from "../../src/firebase.js";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";

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
      body[decodeURIComponent(key)] = decodeURIComponent(value || "");
    });

    await setDoc(doc(collection(db, `forms/${formId}/submissions`)), {
      data: body,
      submittedAt: serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "Form submitted successfully!",
      data: body,
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
