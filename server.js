require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const path = require("path");


const app = express();
const PORT = process.env.PORT || 3000;

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

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Access-Control-Expose-Headers", "Content-Type");
  // Add cache control to ensure request shows in network tab
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// -------------------------
// POST FORM ROUTE
// -------------------------
app.post("/forms/:formId", async (req, res) => {
  const { formId } = req.params;

  if (!formId) {
    return res.status(400).json({ error: "Missing Form ID" });
  }

  if (!db) {
    return res.status(500).json({ error: "Firebase not initialized" });
  }

  try {
    const cleanData = {};

    for (let key in req.body) {
      if (req.body[key] !== "" && key !== "_gotcha") {
        cleanData[key] = req.body[key];
      }
    }

    if (Object.keys(cleanData).length === 0) {
      return res.status(400).json({ error: "No form data received" });
    }

    await db.collection(`forms/${formId}/submissions`).add({
      data: cleanData,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const acceptsHtml = req.headers.accept?.includes("text/html");

    if (acceptsHtml) {
      // Show an alert and return to the previous page so the user never leaves
      return res.send(`
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

    return res.json({ success: true, message: "Form submitted successfully", data: cleanData });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// SERVE REACT IN PRODUCTION

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
  });
} 

// -------------------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
