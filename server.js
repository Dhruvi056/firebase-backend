require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

let db;

if (!admin.apps.length) {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
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
  console.log(" Firebase Admin Initialized");
}

/* -------------------- Middleware -------------------- */

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

/* -------------------- Nodemailer Setup -------------------- */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
});

/* -------------------- FORM SUBMIT API -------------------- */

app.post("/api/forms/:formId", async (req, res) => {
  const { formId } = req.params;

  if (!formId) {
    return res.status(400).json({ error: "Missing Form ID" });
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

    // 1️⃣ Save submission
    await db.collection(`forms/${formId}/submissions`).add({
      data: cleanData,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2️⃣ Send email if configured
    const formDoc = await db.collection("forms").doc(formId).get();

    if (formDoc.exists) {
      const formData = formDoc.data();
      const notifyEmail = formData.notifyEmail || formData.notificationEmail;

      if (notifyEmail) {
        // For local development, send email directly
        // For production/Vercel, we'll use the API approach
        if (process.env.NODE_ENV === 'production') {
          // Vercel deployment - call the API route
          // In Vercel, we can make a direct call to the API route
          // We'll construct the full URL based on the request origin
          const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                         req.get('host') ? `${req.protocol}://${req.get('host')}` : 
                         'http://localhost:3000';
         
          const emailPayload = {
            toEmail: notifyEmail,
            formData: cleanData,
            formName: formData.name || formId,
            formUrl: formData.url || "N/A"
          };

          // In Vercel, we can call the email service directly
          try {
            // Require the email service and call it directly
            const { sendNotificationEmail } = require(path.join(__dirname, './src/utils/emailService'));
            
            await sendNotificationEmail(
              emailPayload.toEmail,
              emailPayload.formData,
              emailPayload.formName,
              emailPayload.formUrl
            );
            
            console.log(`📧 Notification email sent to ${notifyEmail} via Vercel API`);
          } catch (emailError) {
            console.error('Error sending email in Vercel:', emailError);
          }
        } else {
          // Local development - send email directly
          try {
            await transporter.sendMail({
              from: `"Form App" <${process.env.EMAIL_USER}>`,
              to: notifyEmail,
              subject: `New Form Submission - ${formData.name || formId}`,
              html: `
                <h2>New Form Submission</h2>
                <p><b>Form:</b> ${formData.name || formId}</p>
                <p><b>Form URL:</b> ${formData.url || "N/A"}</p>
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
            console.log(`📧 Email sent to ${notifyEmail}`);
          } catch (emailError) {
            console.error('Error sending local email:', emailError);
          }
        }
      }
    }

    return res.json({
      success: true,
      message: "Form submitted successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

/* -------------------- Serve React (Production) -------------------- */

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
  });
}

/* -------------------- Start Server -------------------- */

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});