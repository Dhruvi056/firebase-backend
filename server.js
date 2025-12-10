require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 3000;

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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
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

    // Check if request expects HTML response (standard form submission without script)
    const acceptHeader = req.headers.accept || req.headers["accept"] || "";
    const htmlAccepted = acceptHeader.includes("text/html");
    const jsonAccepted = acceptHeader.includes("application/json");
    
    console.log("Accept header:", acceptHeader);
    console.log("Accepts HTML:", htmlAccepted);
    console.log("Accepts JSON:", jsonAccepted);
    
    // If explicitly requesting JSON, return JSON
    if (jsonAccepted && !htmlAccepted) {
      return res.json({ success: true, message: "Form submitted successfully!", data: cleanData });
    }
    
    if (htmlAccepted) {
      // Return HTML page that immediately goes back and shows toast
      const referer = req.headers.referer || '/';
      const message = 'Form submitted successfully!';
      
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Form Submitted</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: Arial, sans-serif;
                background: transparent;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
              }
              .toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 99999;
                animation: slideIn 0.2s ease-out;
              }
              @keyframes slideIn {
                from {
                  transform: translateX(400px);
                  opacity: 0;
                }
                to {
                  transform: translateX(0);
                  opacity: 1;
                }
              }
              .toast {
                background: #e8f5e9;
                color: #166534;
                padding: 16px 20px;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                max-width: 320px;
                font-size: 14px;
                line-height: 1.5;
                border-left: 4px solid #4caf50;
              }
              .toast-icon {
                font-size: 20px;
                margin-right: 8px;
                display: inline-block;
              }
            </style>
          </head>
          <body>
            <div class="toast-container">
              <div class="toast" id="toast">
                <span class="toast-icon">✓</span>
                <span id="toast-message">${message}</span>
              </div>
            </div>
            <script>
              // Store message in localStorage for parent page
              try {
                localStorage.setItem('__firebase_form_toast__', JSON.stringify({
                  message: '${message}',
                  success: true,
                  timestamp: Date.now()
                }));
              } catch(e) {}
              
              // Show toast briefly
              const toast = document.getElementById('toast');
              
              // Immediately try to go back (no delay)
              if (window.history.length > 1) {
                setTimeout(() => {
                  window.history.back();
                }, 100);
              } else {
                const referer = '${referer}';
                if (referer && referer !== window.location.href) {
                  setTimeout(() => {
                    window.location.href = referer;
                  }, 100);
                } else {
                  setTimeout(() => {
                    toast.style.transition = 'opacity 0.3s';
                    toast.style.opacity = '0';
                  }, 3500);
                }
              }
              
              setTimeout(() => {
                toast.style.transition = 'opacity 0.3s';
                toast.style.opacity = '0';
              }, 4000);
            </script>
          </body>
        </html>
      `);
    }

    // Return JSON for AJAX/fetch requests (with script tag)
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.json({ success: true, message: "Form submitted successfully!", data: cleanData });
  } catch (err) {
    console.error("❌ Error submitting form:", err);
    console.error("Error stack:", err.stack);
    
    const htmlAccepted = req.headers.accept?.includes("text/html");
    
    if (htmlAccepted) {
      const referer = req.headers.referer || '/';
      const errorMsg = err.message.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Submission Error</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: Arial, sans-serif;
                background: transparent;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
              }
              .toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 99999;
                animation: slideIn 0.2s ease-out;
              }
              @keyframes slideIn {
                from {
                  transform: translateX(400px);
                  opacity: 0;
                }
                to {
                  transform: translateX(0);
                  opacity: 1;
                }
              }
              .toast {
                background: #fee2e2;
                color: #991b1b;
                padding: 16px 20px;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                max-width: 320px;
                font-size: 14px;
                line-height: 1.5;
                border-left: 4px solid #f44336;
              }
              .toast-icon {
                font-size: 20px;
                margin-right: 8px;
                display: inline-block;
              }
            </style>
          </head>
          <body>
            <div class="toast-container">
              <div class="toast" id="toast">
                <span class="toast-icon">✗</span>
                <span id="toast-message">Error: ${errorMsg}</span>
              </div>
            </div>
            <script>
              try {
                localStorage.setItem('__firebase_form_toast__', JSON.stringify({
                  message: 'Error: ${errorMsg}',
                  success: false,
                  timestamp: Date.now()
                }));
              } catch(e) {}
              
              const toast = document.getElementById('toast');
              
              if (window.history.length > 1) {
                setTimeout(() => {
                  window.history.back();
                }, 100);
              } else {
                const referer = '${referer}';
                if (referer && referer !== window.location.href) {
                  setTimeout(() => {
                    window.location.href = referer;
                  }, 100);
                } else {
                  setTimeout(() => {
                    toast.style.transition = 'opacity 0.3s';
                    toast.style.opacity = '0';
                  }, 3500);
                }
              }
              
              setTimeout(() => {
                toast.style.transition = 'opacity 0.3s';
                toast.style.opacity = '0';
              }, 4000);
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
