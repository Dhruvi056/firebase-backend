import admin from "firebase-admin";
import querystring from "querystring";
import nodemailer from "nodemailer";
import { v2 as cloudinary } from "cloudinary";
import Busboy from "busboy";

/* -------------------- Cloudinary Setup -------------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

// ---------------------
// Helper: Parse Body (supports multipart with file uploads)
// ---------------------
function parseBody(req) {
  const contentType = req.headers["content-type"] || "";

  if (contentType.includes("application/json")) {
    const fields = {};
    const files = [];

    if (req.body && typeof req.body === 'object') {
      for (const [key, value] of Object.entries(req.body)) {
        if (value && typeof value === 'object' && value.dataUrl) {
          try {
            const base64Data = value.dataUrl.split(',')[1];
            if (base64Data) {
              files.push({
                fieldname: key,
                originalname: value.fileName || "file",
                mimetype: value.mimeType || "application/octet-stream",
                buffer: Buffer.from(base64Data, "base64"),
              });
            }
          } catch (e) {
            console.error("Skipping failed base64 parse for:", key);
          }
        } else {
          fields[key] = value;
        }
      }
    }
    return { fields, files };
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    if (typeof req.body === "string") {
      return { fields: querystring.parse(req.body), files: [] };
    }
    return { fields: req.body, files: [] };
  }

  // Handle multipart/form-data using busboy
  if (contentType.includes("multipart/form-data")) {
    return new Promise((resolve, reject) => {
      const fields = {};
      const files = [];

      const busboy = Busboy({ headers: req.headers });

      busboy.on("field", (fieldname, val) => {
        fields[fieldname] = val;
      });

      busboy.on("file", (fieldname, fileStream, info) => {
        const { filename, mimeType } = info;
        const chunks = [];

        fileStream.on("data", (chunk) => {
          chunks.push(chunk);
        });

        fileStream.on("end", () => {
          files.push({
            fieldname,
            originalname: filename,
            mimetype: mimeType,
            buffer: Buffer.concat(chunks),
          });
        });
      });

      busboy.on("finish", () => {
        resolve({ fields, files });
      });

      busboy.on("error", (err) => {
        reject(err);
      });

      // Pipe the request to busboy
      if (req.body && Buffer.isBuffer(req.body)) {
        busboy.end(req.body);
      } else if (typeof req.body === "string") {
        busboy.end(Buffer.from(req.body));
      } else {
        req.pipe(busboy);
      }
    });
  }

  return { fields: {}, files: [] };
}

// Helper: Upload file buffer to Cloudinary
function uploadToCloudinary(file, formId) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const isPdf =
        file.mimetype === "application/pdf" ||
        file.originalname.toLowerCase().endsWith(".pdf");
    const safeName = file.originalname || "file";

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `forms/${formId}`,
        // Raw files need their exact extension in public_id
        public_id: isPdf ? `${timestamp}-${safeName}` : `${timestamp}-${safeName.replace(/\.[^/.]+$/, "")}`,
        resource_type: isPdf ? "raw" : "auto",
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return reject(error);
        }
        console.log(`Uploaded to Cloudinary: ${result.secure_url}`);
       const fileUrl =result.secure_url.replace("/upload/", "/upload/fl_attachment/");
        resolve({
           url: fileUrl,
           publicId: result.public_id,
           fieldname: file.fieldname,
        });
      }
    );

    const { Readable } = require("stream");
    const readable = new Readable();
    readable.push(file.buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

// Setup Nodemailer transporter
function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("Email credentials not configured. Emails will not be sent.");
    console.warn("EMAIL_USER:", process.env.EMAIL_USER ? "SET" : "NOT SET");
    console.warn("EMAIL_PASS:", process.env.EMAIL_PASS ? "SET" : "NOT SET");
    return null;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail App Password
      },
    });
    console.log("Email transporter created successfully");
    return transporter;
  } catch (error) {
    console.error("Error creating email transporter:", error);
    return null;
  }
}

// Send notification email
async function sendNotificationEmail(toEmail, formData, formName, formUrl, cleanData) {
  console.log(`Attempting to send email to: ${toEmail}`);
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("Email transporter not available. Skipping email notification.");
    return { success: false, error: "Transporter not available" };
  }

  try {
    const mailOptions = {
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
    };

    console.log("Sending email with options:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Notification email sent successfully to ${toEmail}`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (emailError) {
    console.error("Error sending notification email:", emailError);
    console.error("Error details:", {
      message: emailError.message,
      code: emailError.code,
      command: emailError.command,
      response: emailError.response,
    });
    return { success: false, error: emailError.message };
  }
}

// ---------------------
// Main Handler
// ---------------------
export default async function handler(req, res) {

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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
    //  Parse Form Body
    const parsed = await parseBody(req);
    const formData = parsed.fields || {};
    const uploadedFiles = parsed.files || [];

    if (
      (!formData || Object.keys(formData).length === 0) &&
      uploadedFiles.length === 0
    ) {
      return res.status(400).json({
        error: "No form data received",
      });
    }

    //  Clean empty fields and filter out Cloudflare Turnstile response
    const cleanData = {};
    for (let key in formData) {
      // Skip Cloudflare Turnstile response field
      if (key === 'cf-turnstile-response') {
        continue;
      }
      if (formData[key] !== "" && formData[key] !== null) {
        cleanData[key] = formData[key];
      }
    }

    // Upload files to Cloudinary (if any)
    if (uploadedFiles.length > 0) {
      const uploadResults = await Promise.all(
        uploadedFiles.map((file) => uploadToCloudinary(file, formId))
      );

      for (const result of uploadResults) {
        const fieldName = result.fieldname || "file";
        if (cleanData[fieldName] === undefined) {
          cleanData[fieldName] = result.url;
        } else if (Array.isArray(cleanData[fieldName])) {
          cleanData[fieldName].push(result.url);
        } else {
          cleanData[fieldName] = [cleanData[fieldName], result.url];
        }
      }
    }

    //  Save to Firestore
    await db.collection(`forms/${formId}/submissions`).add({
      data: cleanData,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send email notification if configured
    let emailResult = null;
    try {
      const formDoc = await db.collection("forms").doc(formId).get();
      
      if (formDoc.exists) {
        const formData = formDoc.data();
        const notifyEmail = formData.notifyEmail || formData.notificationEmail;

        if (notifyEmail) {
          console.log(`Form has notification email configured: ${notifyEmail}`);
          // Wait for email to be sent (with timeout protection)
          emailResult = await Promise.race([
            sendNotificationEmail(
              notifyEmail,
              formData,
              formData.name || formId,
              formData.url || "N/A",
              cleanData
            ),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Email timeout")), 8000)
            ),
          ]).catch((err) => {
            console.error("Failed to send notification email:", err);
            return { success: false, error: err.message };
          });
        } else {
          console.log("No notification email configured for this form");
        }
      } else {
        console.log(`Form document ${formId} not found`);
      }
    } catch (emailError) {
      // Log but don't fail the request if email check fails
      console.error("Error checking for notification email:", emailError);
    }

    //  Response
    return res.status(200).json({
      success: true,
      message: "Form submitted successfully",
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      message: error.message,
    });
  }
}
