require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const path = require("path");
const nodemailer = require("nodemailer");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

/* -------------------- Cloudinary Setup -------------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log("☁️ Cloudinary configured:", process.env.CLOUDINARY_CLOUD_NAME ? "YES" : "NO");

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

// Multer for handling multipart/form-data (file uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  },
});

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

async function handleFormSubmit(req, res) {
  const { formId } = req.params;

  if (!formId) {
    return res.status(400).json({ error: "Missing Form ID" });
  }

  try {
    const cleanData = {};
    const allFiles = [...(req.files || [])];

    // Detect embedded base64 files in JSON payload
    if (req.headers["content-type"] && req.headers["content-type"].includes("application/json")) {
      for (let key in req.body) {
        const val = req.body[key];
        if (val && typeof val === 'object' && val.dataUrl) {
          try {
            const base64Data = val.dataUrl.split(',')[1];
            if (base64Data) {
              allFiles.push({
                fieldname: key,
                originalname: val.fileName || "file",
                mimetype: val.mimeType || "application/octet-stream",
                buffer: Buffer.from(base64Data, "base64"),
              });
              // Ensure this doesn't get saved as a standard form field
              delete req.body[key];
            }
          } catch (e) {
            console.error("Skipping failed base64 parse for:", key);
          }
        }
      }
    }

    for (let key in req.body) {
      if (req.body[key] !== "" && key !== "_gotcha") {
        cleanData[key] = req.body[key];
      }
    }

    // Handle file uploads (if any) using Cloudinary
    if (allFiles.length > 0) {
      const uploadPromises = allFiles.map(async (file) => {
        const safeOriginalName = file.originalname || "file";
        const timestamp = Date.now();

        // Determine resource_type based on mimetype
        const isPdf =
              file.mimetype === "application/pdf" ||
              file.originalname.toLowerCase().endsWith(".pdf");
        let resourceType = isPdf ? "raw" : "auto"; // PDF must be raw so it downloads/views securely

        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: `forms/${formId}`,
              // For raw files, Cloudinary needs the exact extension inside the public_id
              public_id: isPdf ? `${timestamp}-${safeOriginalName}` : `${timestamp}-${safeOriginalName.replace(/\.[^/.]+$/, "")}`,
              resource_type: resourceType,
              
            },
            (error, result) => {
              if (error) {
                console.error("Cloudinary upload error:", error);
                return reject(error);
              }

              const publicUrl = result.secure_url.replace(
                "/upload/",
                "/upload/fl_attachment/"
              );
              const fieldName = file.fieldname || "file";

              if (cleanData[fieldName] === undefined) {
                cleanData[fieldName] = publicUrl;
              } else if (Array.isArray(cleanData[fieldName])) {
                cleanData[fieldName].push(publicUrl);
              } else {
                cleanData[fieldName] = [cleanData[fieldName], publicUrl];
              }

              console.log(`☁️ File uploaded to Cloudinary: ${publicUrl}`);
              resolve(result);
            }
          );

          // Pipe the file buffer to Cloudinary
          const { Readable } = require("stream");
          const readableStream = new Readable();
          readableStream.push(file.buffer);
          readableStream.push(null);
          readableStream.pipe(uploadStream);
        });
      });

      await Promise.all(uploadPromises);
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

    // 3️⃣ Build a friendly success message (used by embed-form.js toast)
    const { name, fname, lname } = cleanData;
    const fullName = name || [fname, lname].filter(Boolean).join(" ");
    const successPayload = {
      success: true,
      message: fullName
        ? `Form submitted successfully. Thank you, ${fullName}!`
        : "Form submitted successfully",
    };
    const acceptsHeader = req.headers.accept || "";
    const wantsJson = acceptsHeader.includes("application/json");

    if (wantsJson) {
      return res.json(successPayload);
    }
  return res.status(204).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

// Primary routes
// Use multer to handle multipart/form-data (files) + regular fields
app.post("/api/forms/:formId", upload.any(), handleFormSubmit);
app.post("/api/f/:formId", upload.any(), handleFormSubmit);

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