require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");

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

try {
  if (!admin.apps.length) {
    console.log("Initializing Firebase Admin...");

    // Check if credentials are set
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      console.log("❌ FIREBASE ERROR: Missing required environment variables");
      console.log("   Please check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your .env file");
    } else {
      // Clean up the private key - handle both \n and actual newlines
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      console.log("Processing private key...");
      console.log("Private key length:", privateKey.length);
      console.log("Private key starts with:", privateKey.substring(0, 30));
      
      // Remove quotes if present (both single and double)
      if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || 
          (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1);
      }
      
      // Replace \\n with actual newlines (handle escaped newlines)
      privateKey = privateKey.replace(/\\n/g, "\n");
      
      // Remove any extra whitespace at start/end
      privateKey = privateKey.trim();
      
      // Validate key format
      if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
        console.error("❌ Invalid private key format: Missing BEGIN PRIVATE KEY");
        throw new Error("Private key must start with '-----BEGIN PRIVATE KEY-----'");
      }
      
      if (!privateKey.includes("-----END PRIVATE KEY-----")) {
        console.error("❌ Invalid private key format: Missing END PRIVATE KEY");
        throw new Error("Private key must end with '-----END PRIVATE KEY-----'");
      }
      
      // Ensure proper newlines around key boundaries
      privateKey = privateKey.replace(/-----BEGIN PRIVATE KEY-----[^\n]/, "-----BEGIN PRIVATE KEY-----\n");
      privateKey = privateKey.replace(/[^\n]-----END PRIVATE KEY-----/, "\n-----END PRIVATE KEY-----");
      
      // Remove any extra spaces or issues
      privateKey = privateKey.replace(/\r\n/g, "\n"); // Windows line endings
      privateKey = privateKey.replace(/\r/g, "\n"); // Old Mac line endings
      
      console.log("Private key cleaned successfully");
      console.log("Key starts with:", privateKey.substring(0, 50));
      console.log("Key ends with:", privateKey.substring(privateKey.length - 50));

      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
          }),
        });

        db = admin.firestore();
        console.log("🔥 Firebase Admin Connected Successfully");
      } catch (initError) {
        console.error("❌ Firebase initialization failed:", initError.message);
        console.error("Error details:", initError);
        throw initError;
      }
    }
  }
} catch (err) {
  console.log("❌ FIREBASE ERROR:", err.message);
  console.log("   Error type:", err.name);
  if (err.stack) {
    console.log("   Stack:", err.stack);
  }
  console.log("\n💡 TROUBLESHOOTING TIPS:");
  console.log("   1. Make sure FIREBASE_PRIVATE_KEY is in quotes: FIREBASE_PRIVATE_KEY=\"...\"");
  console.log("   2. Keep \\n characters in the key (they represent newlines)");
  console.log("   3. The key should start with '-----BEGIN PRIVATE KEY-----'");
  console.log("   4. The key should end with '-----END PRIVATE KEY-----'");
  console.log("   5. Copy the ENTIRE private_key value from Firebase JSON file");
  console.log("   6. Make sure there are no extra spaces or characters");
  console.log("\n   Example format in .env:");
  console.log('   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n"');
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// -------------------------
// POST FORM ROUTE
// -------------------------
app.post("/api/f/:formId", async (req, res) => {
  const { formId } = req.params;

  console.log("\n=== Form Submission Debug (Local) ===");
  console.log("Method:", req.method);
  console.log("FormId:", formId);
  console.log("Content-Type:", req.headers["content-type"]);
  console.log("req.body:", JSON.stringify(req.body, null, 2));
  console.log("req.body type:", typeof req.body);
  console.log("req.body keys:", Object.keys(req.body || {}));

  if (!formId)
    return res.status(400).json({ error: "Missing Form ID" });

  if (!db) {
    console.error("❌ Firebase not initialized");
    return res.status(500).json({ error: "Firebase not initialized" });
  }

  try {
    const cleanData = {};

    // Log all body data
    console.log("Processing form data...");
    console.log("Raw req.body:", req.body);

    Object.keys(req.body || {}).forEach((key) => {
      if (key !== "_gotcha" && req.body[key] !== "" && req.body[key] !== undefined && req.body[key] !== null) {
        cleanData[key] = req.body[key];
        console.log(`  - ${key}: ${req.body[key]}`);
      }
    });

    console.log("Clean data to save:", JSON.stringify(cleanData, null, 2));

    if (Object.keys(cleanData).length === 0) {
      console.error("❌ No data to save after cleaning");
      return res.status(400).json({ 
        error: "No form data received",
        debug: {
          bodyType: typeof req.body,
          bodyKeys: Object.keys(req.body || {}),
          bodyContent: req.body
        }
      });
    }

    const docRef = await db
      .collection(`forms/${formId}/submissions`)
      .add({
        data: cleanData,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    console.log("✅ Successfully saved submission with ID:", docRef.id);
    console.log("=== End Debug ===\n");

    const acceptsHtml = req.headers.accept?.includes("text/html");
    const referer = req.headers.referer || "#";

    if (acceptsHtml) {
      // Return HTML page with toast that auto-redirects (for users without script tag access)
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Form Submitted</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
                background: transparent;
              }
              #toast {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 16px 24px;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                background: #e8f5e9;
                color: #166534;
                z-index: 99999;
                max-width: 400px;
                font-size: 14px;
                animation: slideIn 0.3s ease-out;
              }
              @keyframes slideIn {
                from {
                  transform: translateX(100%);
                  opacity: 0;
                }
                to {
                  transform: translateX(0);
                  opacity: 1;
                }
              }
              @keyframes slideOut {
                from {
                  transform: translateX(0);
                  opacity: 1;
                }
                to {
                  transform: translateX(100%);
                  opacity: 0;
                }
              }
              #toast.error {
                background: #fee2e2;
                color: #991b1b;
              }
            </style>
          </head>
          <body>
            <div id="toast">✓ Form submitted successfully!</div>
            <script>
              setTimeout(function() {
                var toast = document.getElementById('toast');
                toast.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(function() {
                  window.location.href = ${JSON.stringify(referer)};
                }, 300);
              }, 3000);
            </script>
          </body>
        </html>
      `);
    }

    // Return JSON for AJAX/fetch requests (with script tag)
    return res.json({ success: true, message: "Form submitted successfully", data: cleanData });
  } catch (err) {
    console.error("❌ Error submitting form:", err);
    console.error("Error stack:", err.stack);
    
    const acceptsHtml = req.headers.accept?.includes("text/html");
    const referer = req.headers.referer || "#";
    
    if (acceptsHtml) {
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Submission Error</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
                background: transparent;
              }
              #toast {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 16px 24px;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                background: #fee2e2;
                color: #991b1b;
                z-index: 99999;
                max-width: 400px;
                font-size: 14px;
                animation: slideIn 0.3s ease-out;
              }
              @keyframes slideIn {
                from {
                  transform: translateX(100%);
                  opacity: 0;
                }
                to {
                  transform: translateX(0);
                  opacity: 1;
                }
              }
              @keyframes slideOut {
                from {
                  transform: translateX(0);
                  opacity: 1;
                }
                to {
                  transform: translateX(100%);
                  opacity: 0;
                }
              }
            </style>
          </head>
          <body>
            <div id="toast">✗ Error: ${err.message}</div>
            <script>
              setTimeout(function() {
                var toast = document.getElementById('toast');
                toast.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(function() {
                  window.location.href = ${JSON.stringify(referer)};
                }, 300);
              }, 3000);
            </script>
          </body>
        </html>
      `);
    }
    
    return res.status(500).json({ error: err.message });
  }
});


// GET FORM ROUTE

app.get("/api/f/:formId", (req, res) => {
  res.send(`
    <h1>POST only</h1>
    <p>Use this endpoint inside HTML form</p>
  `);
});


// SERVE REACT IN PRODUCTION

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
  });
} else {
  app.use(
    /^\/(?!api).*/,
    createProxyMiddleware({
      target: "http://localhost:3001",
      changeOrigin: true,
      ws: true,
    })
  );
}

// -------------------------
app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
