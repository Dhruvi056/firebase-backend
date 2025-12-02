// api/f/[formId].js
import { db } from "../../src/firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { formId } = req.query;

  if (!formId) {
    return res.status(400).json({ error: "Missing formId" });
  }

  try {
    let body = {};

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const data = Buffer.concat(chunks).toString();

    data.split("&").forEach((pair) => {
      const [key, value] = pair.split("=");
      body[decodeURIComponent(key)] = decodeURIComponent(value || "");
    });

    await setDoc(doc(collection(db, `forms/${formId}/submissions`)), {
      data: body,
      submittedAt: serverTimestamp(),
    });

    return res.status(200).json({ success: true, message: "Form submitted" });

  } catch (error) {
    console.error("Submit error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
