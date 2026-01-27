import admin from "firebase-admin";
import querystring from "querystring";
import nodemailer from "nodemailer";


// Initialize Firebase

let db;
if (!admin.apps.length) {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    // Handle different escape formats (Vercel environment variables)
    // Replace escaped newlines with actual newlines
    privateKey = privateKey.replace(/\\n/g, "\n");
    // Also handle if it's already a string with literal \n
    privateKey = privateKey.replace(/\\\\n/g, "\n");
    // Remove quotes if present
    privateKey = privateKey.replace(/^["']|["']$/g, "");
  }

  if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error("Missing Firebase configuration");
    throw new Error("Firebase configuration is incomplete");
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });

    db = admin.firestore();
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error.message);
    throw error;
  }
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

// Setup Nodemailer transporter
function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("Email credentials not configured. Emails will not be sent.");
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Gmail App Password
    },
  });
}

// Send notification email
async function sendNotificationEmail(toEmail, formData, formName, formUrl, cleanData) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("Email transporter not available. Skipping email notification.");
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Form App" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `New Form Submission - ${formName}`,
      html: `
        <h2>New Form Submission</h2>
        <p><b>Form:</b> ${formName}</p>
        <p><b>Form URL:</b> ${formUrl || "N/A"}</p>
        <hr/>
        ${Object.entries(cleanData)
          .map(
            ([key, value]) =>
              `<p><b>${key}:</b> ${
                Array.isArray(value) ? value.join(", ") : value
              }</p>`
          )
          .join("")}
      `,
    });
    console.log(`📧 Notification email sent to ${toEmail}`);
  } catch (emailError) {
    console.error("Error sending notification email:", emailError);
    // Don't throw - we don't want email failures to break form submissions
  }
}

// Main Handler
export default async function handler(req, res) {

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Handle GET requests gracefully (for browser navigation/refresh)
  if (req.method === "GET") {
    return res.status(200).json({
      message: "This is a form submission endpoint. Use POST method to submit form data.",
      endpoint: `/api/forms/${req.query.formId || "formId"}`,
      method: "POST"
    });
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
   
    const formData = parseBody(req);

    if (!formData || Object.keys(formData).length === 0) {
      return res.status(400).json({
        error: "No form data received",
      });
    }

    const cleanData = {};
    for (let key in formData) {
     
      if (key === 'cf-turnstile-response') {
        continue;
      }
      if (formData[key] !== "" && formData[key] !== null) {
        cleanData[key] = formData[key];
      }
    }

    await db.collection(`forms/${formId}/submissions`).add({
      data: cleanData,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send email notification if configured
    try {
      const formDoc = await db.collection("forms").doc(formId).get();
      
      if (formDoc.exists) {
        const formData = formDoc.data();
        const notifyEmail = formData.notifyEmail || formData.notificationEmail;

        if (notifyEmail) {
          // Send email asynchronously (don't wait for it to complete)
          sendNotificationEmail(
            notifyEmail,
            formData,
            formData.name || formId,
            formData.url || "N/A",
            cleanData
          ).catch((err) => {
            console.error("Failed to send notification email:", err);
          });
        }
      }
    } catch (emailError) {
      // Log but don't fail the request if email check fails
      console.error("Error checking for notification email:", emailError);
    }

    const acceptsHtml = req.headers.accept?.includes("text/html");

    if (acceptsHtml) {
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

