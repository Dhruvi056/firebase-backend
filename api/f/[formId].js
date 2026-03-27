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
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e1e8ed; }
            .header { background: linear-gradient(135deg, #6571ff 0%, #060c17 100%); padding: 40px 20px; text-align: center; color: white; }
            .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; margin-bottom: 5px; color: #ffffff; }
            .logo span { color: rgba(255,255,255,0.7); font-weight: 400; }
            .title { font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; margin-top: 10px; }
            .content { padding: 40px; }
            .form-info { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px; border-left: 4px solid #6571ff; }
            .form-name { font-size: 18px; font-weight: 700; color: #060c17; margin-bottom: 5px; }
            .form-url { font-size: 13px; color: #6571ff; text-decoration: none; word-break: break-all; }
            .submission-data { width: 100%; border-collapse: separate; border-spacing: 0 12px; }
            .submission-data th { text-align: left; vertical-align: top; padding: 0 15px 0 0; color: #7987a1; font-size: 12px; text-transform: uppercase; font-weight: 600; width: 35%; padding-top: 4px; }
            .submission-data td { padding-bottom: 12px; border-bottom: 1px solid #edf1f7; color: #060c17; font-size: 15px; font-weight: 500; word-break: break-all; }
            .footer { background-color: #f8f9fa; padding: 30px; text-align: center; font-size: 13px; color: #aeb7c5; border-top: 1px solid #edf1f7; }
            .btn { display: inline-block; padding: 14px 28px; background-color: #6571ff; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 30px; box-shadow: 0 4px 14px rgba(101, 113, 255, 0.4); }
            .file-link { color: #6571ff; text-decoration: none; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">CS <span>Formly</span></div>
              <div class="title">New Submission</div>
            </div>
            <div class="content">
              <div class="form-info">
                <div class="form-name">${formName}</div>
                <a href="${formUrl}" class="form-url">${formUrl || "Form URL not provided"}</a>
              </div>
              
              <table class="submission-data">
                ${Object.entries(cleanData)
                  .map(([key, value]) => {
                    const displayValue = Array.isArray(value) 
                      ? value.map(v => typeof v === 'string' && v.startsWith('http') ? `<a href="${v}" class="file-link">View Attachment</a>` : v).join(", ")
                      : (typeof value === 'string' && value.startsWith('http')) 
                        ? `<a href="${value}" class="file-link">View Attachment</a>` 
                        : value;
                        
                    return `
                      <tr>
                        <th>${key}</th>
                        <td>${displayValue}</td>
                      </tr>
                    `;
                  }).join('')}
              </table>
              
              <div style="text-align: center; margin-top: 20px;">
                <a href="${formUrl}" class="btn">Go to Dashboard</a>
              </div>
            </div>
            <div class="footer">
              This notification was sent via <strong>CS Formly</strong>. <br/>
              The all-in-one headless form solution.
            </div>
          </div>
        </body>
        </html>
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
          
          const protocol = req.headers["x-forwarded-proto"] || "http";
          const host = req.headers.host;
          const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                         host ? `${protocol}://${host}` : 
                         'http://localhost:3000';
          const dashboardUrl = `${baseUrl}/forms/${formId}`;

          // Wait for email to be sent (with timeout protection)
          emailResult = await Promise.race([
            sendNotificationEmail(
              notifyEmail,
              formData,
              formData.name || formId,
              dashboardUrl,
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
