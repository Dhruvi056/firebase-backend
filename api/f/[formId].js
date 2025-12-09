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


// Initialize Firebase Admin SDK
let db;
if (!admin.apps.length) {
  try {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      console.error("Missing Firebase Admin environment variables");
    } else {
      // Clean up private key
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, "\n");
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
      db = admin.firestore();
      console.log("Firebase Admin initialized successfully");
    }
  } catch (error) {
    console.error("Firebase Admin initialization error:", error.message);
  }
} else {
  db = admin.firestore();
}

// Helper function to parse form data
function parseFormData(body, contentType) {
  const data = {};
  
  if (contentType?.includes("application/json")) {
    // JSON data
    try {
      return typeof body === "string" ? JSON.parse(body) : body;
    } catch (e) {
      console.error("JSON parse error:", e);
      return {};
    }
  } else if (contentType?.includes("application/x-www-form-urlencoded")) {
    // Standard HTML form submission - use querystring for proper parsing
    if (typeof body === "string") {
      try {
        return querystring.parse(body);
      } catch (e) {
        console.error("querystring parse error:", e);
        // Fallback to manual parsing
        body.split("&").forEach((pair) => {
          const [key, value = ""] = pair.split("=");
          if (key) {
            data[decodeURIComponent(key)] = decodeURIComponent(value);
          }
        });
      }
    }
    return data;
  } else if (contentType?.includes("multipart/form-data")) {
    // Multipart form data (for file uploads)
    // For now, parse as URL-encoded if possible
    if (typeof body === "string") {
      try {
        return querystring.parse(body);
      } catch (e) {
        body.split("&").forEach((pair) => {
          const [key, value = ""] = pair.split("=");
          if (key) {
            data[decodeURIComponent(key)] = decodeURIComponent(value);
          }
        });
      }
    }
    return data;
  } else {
    // Try to parse as URL-encoded by default (for standard HTML forms)
    if (typeof body === "string") {
      try {
        return querystring.parse(body);
      } catch (e) {
        body.split("&").forEach((pair) => {
          const [key, value = ""] = pair.split("=");
          if (key) {
            data[decodeURIComponent(key)] = decodeURIComponent(value);
          }
        });
      }
    } else if (typeof body === "object" && body !== null) {
      return body;
    }
    return data;
  }
}

export default async function handler(req, res) {
  // Set CORS headers to allow cross-origin form submissions
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Prevent browser GET redirect
  if (req.method !== "POST") {
    const acceptsHtml = req.headers.accept?.includes("text/html");
    
    if (acceptsHtml) {
      // Return HTML response for browser GET requests
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Form Endpoint</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 5px; }
            </style>
          </head>
          <body>
            <div class="error">
              <h2>This endpoint only accepts POST requests</h2>
              <p>This URL is meant to be used as a form action. Do not open it directly in a browser.</p>
              <p>Use it in your HTML form like this:</p>
              <pre style="background: #f5f5f5; padding: 10px; border-radius: 3px;">
&lt;form action="${req.url}" method="POST"&gt;
  &lt;input type="text" name="name" /&gt;
  &lt;input type="email" name="email" /&gt;
  &lt;button type="submit"&gt;Submit&lt;/button&gt;
&lt;/form&gt;
              </pre>
            </div>
          </body>
        </html>
      `);
    }
    
    return res.status(200).json({
      success: false,
      message: "This endpoint only accepts POST requests.",
      tip: "Do not open this URL directly in browser."
    });
  }

  // Get formId from query (Vercel dynamic route)
  const formId = req.query.formId;

  if (!formId) {
    return res.status(400).json({ error: "Missing formId" });
  }

  // Check if Firebase is initialized
  if (!db) {
    return res.status(500).json({ 
      error: "Firebase not initialized",
      message: "Please configure Firebase Admin credentials in Vercel environment variables"
    });
  }

  try {
    // Get request body - Vercel serverless functions need special handling
    const contentType = req.headers["content-type"] || "";
    let formData = {};
    let rawBody = "";
    
    console.log("=== Form Submission Debug ===");
    console.log("Method:", req.method);
    console.log("Content-Type:", contentType);
    console.log("FormId:", formId);
    console.log("req.body type:", typeof req.body);
    console.log("req.body exists:", req.body !== undefined);
    
    // Vercel may provide req.body as a parsed object, string, or undefined
    // For form-urlencoded, Vercel sometimes doesn't parse it automatically
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === "object" && !Buffer.isBuffer(req.body) && !Array.isArray(req.body) && Object.keys(req.body).length > 0) {
        // Already parsed object (Vercel parsed it)
        formData = req.body;
        console.log("✓ Using parsed req.body object:", formData);
      } else if (typeof req.body === "string") {
        // String body - parse it
        rawBody = req.body;
        console.log("✓ Got string body, length:", rawBody.length);
        formData = parseFormData(rawBody, contentType);
        console.log("✓ Parsed formData:", formData);
      } else if (Buffer.isBuffer(req.body)) {
        // Buffer - convert to string and parse
        rawBody = req.body.toString();
        console.log("✓ Got buffer body, length:", rawBody.length);
        formData = parseFormData(rawBody, contentType);
        console.log("✓ Parsed formData:", formData);
      }
    }
    
    // If still no data, return detailed error
    if (!formData || Object.keys(formData).length === 0) {
      console.log("⚠ Body is empty or could not be parsed");
      console.log("Request details:", {
        method: req.method,
        contentType,
        bodyType: typeof req.body,
        bodyExists: req.body !== undefined,
        bodyValue: req.body,
        url: req.url,
        headers: Object.keys(req.headers)
      });
      
      return res.status(400).json({ 
        error: "No form data received",
        hint: "Make sure your form has name attributes on all inputs and is submitting as application/x-www-form-urlencoded",
        debug: {
          contentType,
          bodyType: typeof req.body,
          bodyExists: req.body !== undefined,
          bodyPreview: typeof req.body === "string" ? req.body.substring(0, 100) : String(req.body).substring(0, 100)
        }
      });
    }

    console.log("Final formData:", JSON.stringify(formData, null, 2));

    // Filter out empty values and system fields
    const cleanData = {};
    Object.keys(formData).forEach((key) => {
      // Handle array values (e.g., multiple checkboxes with same name)
      const value = formData[key];
      if (key && key !== "_gotcha" && value !== undefined && value !== null && value !== "") {
        // If it's an array, join it; otherwise use the value as is
        cleanData[key] = Array.isArray(value) ? value.join(", ") : value;
      }
    });

    console.log("Clean data to save:", JSON.stringify(cleanData, null, 2));

    // Validate that we have data to save
    if (Object.keys(cleanData).length === 0) {
      console.error("❌ No data to save after cleaning");
      return res.status(400).json({ 
        error: "No form data received",
        debug: {
          contentType,
          bodyType: typeof req.body,
          bodyPreview: typeof req.body === "string" ? req.body.substring(0, 200) : String(req.body).substring(0, 200),
          parsedData: formData,
          headers: req.headers
        }
      });
    }

    // Use Firebase Admin SDK to write to Firestore
    const submissionsRef = db.collection(`forms/${formId}/submissions`);
    const docRef = await submissionsRef.add({
      data: cleanData,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log("✅ Successfully saved submission with ID:", docRef.id);
    console.log("=== End Debug ===");

    // Check if request expects HTML response (standard form submission)
    // Always return JSON so clients can handle UI (toast/snackbar) without navigation
    return res.status(200).json({
      success: true,
      message: "Form submitted successfully!",
      data: cleanData,
    });

  } catch (e) {
    console.error("❌ Error submitting form:", e);
    console.error("Error stack:", e.stack);
    
    // Always return JSON for error cases too
    return res.status(500).json({ 
      error: "Server error",
      message: e.message,
      stack: process.env.NODE_ENV === "development" ? e.stack : undefined
    });
  }
}
