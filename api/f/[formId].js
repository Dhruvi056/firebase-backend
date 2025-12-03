import admin from "firebase-admin";

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
      return {};
    }
  } else if (contentType?.includes("application/x-www-form-urlencoded")) {
    // Standard HTML form submission
    if (typeof body === "string") {
      body.split("&").forEach((pair) => {
        const [key, value = ""] = pair.split("=");
        if (key) {
          data[decodeURIComponent(key)] = decodeURIComponent(value);
        }
      });
    }
    return data;
  } else if (contentType?.includes("multipart/form-data")) {
    // Multipart form data (for file uploads)
    // For now, parse as URL-encoded if possible
    if (typeof body === "string") {
      body.split("&").forEach((pair) => {
        const [key, value = ""] = pair.split("=");
        if (key) {
          data[decodeURIComponent(key)] = decodeURIComponent(value);
        }
      });
    }
    return data;
  } else {
    // Try to parse as URL-encoded by default (for standard HTML forms)
    if (typeof body === "string") {
      body.split("&").forEach((pair) => {
        const [key, value = ""] = pair.split("=");
        if (key) {
          data[decodeURIComponent(key)] = decodeURIComponent(value);
        }
      });
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
    // Get request body - Vercel might provide req.body, otherwise read from stream
    let body = req.body;
    const contentType = req.headers["content-type"] || "";
    
    // If body is not already parsed, read from stream
    if (body === undefined || body === null) {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks).toString();
    }

    // Parse form data based on content type
    const formData = parseFormData(body, contentType);

    // Filter out empty values and system fields
    const cleanData = {};
    Object.keys(formData).forEach((key) => {
      if (key && key !== "_gotcha" && formData[key] !== undefined && formData[key] !== null) {
        cleanData[key] = formData[key];
      }
    });

    // Use Firebase Admin SDK to write to Firestore
    const submissionsRef = db.collection(`forms/${formId}/submissions`);
    await submissionsRef.add({
      data: cleanData,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Check if request expects HTML response (standard form submission)
    const acceptsHtml = req.headers.accept?.includes("text/html");
    
    if (acceptsHtml) {
      // Return HTML success page for standard form submissions
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Form Submitted Successfully</title>
            <meta http-equiv="refresh" content="3;url=${req.headers.referer || '#'}" />
            <style>
              body { 
                font-family: Arial, sans-serif; 
                max-width: 600px; 
                margin: 100px auto; 
                padding: 20px;
                text-align: center;
              }
              .success { 
                color: #2e7d32; 
                background: #e8f5e9; 
                padding: 30px; 
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .success h1 { margin-top: 0; }
              .success p { color: #555; }
            </style>
          </head>
          <body>
            <div class="success">
              <h1>✓ Form Submitted Successfully!</h1>
              <p>Thank you for your submission. You will be redirected in 3 seconds...</p>
            </div>
          </body>
        </html>
      `);
    }

    // Return JSON response for AJAX/fetch requests
    return res.status(200).json({
      success: true,
      message: "Form submitted successfully!",
      data: cleanData,
    });

  } catch (e) {
    console.error("Error submitting form:", e);
    
    const acceptsHtml = req.headers.accept?.includes("text/html");
    
    if (acceptsHtml) {
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Submission Error</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 5px; }
            </style>
          </head>
          <body>
            <div class="error">
              <h2>Error Submitting Form</h2>
              <p>There was an error processing your submission. Please try again later.</p>
            </div>
          </body>
        </html>
      `);
    }
    
    return res.status(500).json({ 
      error: "Server error",
      message: e.message 
    });
  }
}
