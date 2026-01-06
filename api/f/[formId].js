import admin from "firebase-admin";
import querystring from "querystring";

// ---------------------------------------------------------------------------
// Client-side usage (example toast submission snippet)
// This runs in the browser, NOT on the server. Paste into your HTML page.
//
// <script>
// async function submitForm(event) {
//   event.preventDefault();
//   const form = event.target;
//   const data = new URLSearchParams(new FormData(form)).toString();
//   try {
//     const res = await fetch("https://<your-domain>/api/f/<formId>", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/x-www-form-urlencoded",
//         "Accept": "application/json"
//       },
//       body: data
//     });
//     const json = await res.json();
//     const ok = res.ok;
//     showToast(ok ? (json.message || "Submitted!") : (json.error || json.message || "Failed"), ok);
//     if (ok) form.reset();
//   } catch (err) {
//     showToast("Network error: " + err.message, false);
//   }
// }
//
// function showToast(msg, success) {
//   const toast = document.createElement("div");
//   toast.textContent = msg;
//   toast.style.position = "fixed";
//   toast.style.top = "20px";
//   toast.style.right = "20px";
//   toast.style.padding = "12px 16px";
//   toast.style.borderRadius = "8px";
//   toast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
//   toast.style.background = success ? "#e8f5e9" : "#fee2e2";
//   toast.style.color = success ? "#166534" : "#991b1b";
//   toast.style.zIndex = "9999";
//   document.body.appendChild(toast);
//   setTimeout(() => toast.remove(), 4000);
// }
// </script>
// ---------------------------------------------------------------------------


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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Access-Control-Expose-Headers", "Content-Type");
  // Add cache control to ensure request shows in network tab
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

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
