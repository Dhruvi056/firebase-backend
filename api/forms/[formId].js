import admin from "firebase-admin";
import querystring from "querystring";


// Initialize Firebase

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

  // CORS - Allow forms to work from anywhere (like Getform.io)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Handle GET request (for viewing form endpoint)
  if (req.method === "GET") {
    // Extract formId from query (Vercel rewrite) or from URL path
    const formId = req.query.formId || (req.url ? req.url.split('/').filter(Boolean).pop()?.split('?')[0] : null);
    if (!formId) {
      return res.status(400).send(`
        <!doctype html>
        <html><body><script>alert('Error: Missing Form ID');</script></body></html>
      `);
    }
    return res.status(200).send(`
      <!doctype html>
      <html>
        <head>
          <title>Form Endpoint</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 { color: #333; margin-bottom: 20px; }
            p { color: #666; line-height: 1.6; }
            .info {
              background: #e3f2fd;
              padding: 15px;
              border-radius: 4px;
              margin: 20px 0;
              border-left: 4px solid #2196f3;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Form Endpoint Ready</h1>
            <div class="info">
              <p><strong>Form ID:</strong> ${formId}</p>
              <p>This endpoint is ready to receive form submissions.</p>
              <p>Use <code>action="/forms/${formId}"</code> and <code>method="POST"</code> in your form.</p>
            </div>
          </div>
        </body>
      </html>
    `);
  }

  if (req.method !== "POST") {
    return res.status(405).send(`
      <!doctype html>
      <html><body><script>alert('Error: Only POST requests allowed'); history.back();</script></body></html>
    `);
  }

  // Extract formId from query (Vercel rewrite) or from URL path
  const formId = req.query.formId || (req.url ? req.url.split('/').filter(Boolean).pop()?.split('?')[0] : null);
  if (!formId) {
    return res.status(400).send(`
      <!doctype html>
      <html><body><script>alert('Error: Missing Form ID'); history.back();</script></body></html>
    `);
  }

  if (!db) {
    return res.status(500).send(`
      <!doctype html>
      <html><body><script>alert('Error: Server configuration issue'); history.back();</script></body></html>
    `);
  }

  try {
    const formData = parseBody(req);

    if (!formData || Object.keys(formData).length === 0) {
      return res.status(400).send(`
        <!doctype html>
        <html><body><script>alert('Error: No form data received'); history.back();</script></body></html>
      `);
    }

    const cleanData = {};
    for (let key in formData) {
      if (formData[key] !== "" && formData[key] !== null && formData[key] !== undefined && key !== "_gotcha") {
        cleanData[key] = formData[key];
      }
    }
    
    if (Object.keys(cleanData).length === 0) {
      return res.status(400).send(`
        <!doctype html>
        <html><body><script>alert('Error: No valid form data to save'); history.back();</script></body></html>
      `);
    }

    await db.collection(`forms/${formId}/submissions`).add({
      data: cleanData,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Always return alert message (like Getform.io)
    return res.status(200).send(`
      <!doctype html>
      <html>
        <body>
          <script>
            alert('Thank you! Your form was submitted successfully.');
            if (document.referrer) {
              window.location.replace(document.referrer);
            } else {
              history.back();
            }
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    return res.status(500).send(`
      <!doctype html>
      <html><body><script>alert('Error: ${error.message}'); history.back();</script></body></html>
    `);
  }
}

