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
        let resourceType = isPdf ? "raw" : "auto"; 

        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: `forms/${formId}`,
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

    //Save submission
    await db.collection(`forms/${formId}/submissions`).add({
      data: cleanData,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    //Create in-app notification(s) for new submission
    const formDoc = await db.collection("forms").doc(formId).get();

    if (formDoc.exists) {
      const formData = formDoc.data();
      const recipientIds = Array.from(
        new Set([formData.userId, formData.vendorId].filter(Boolean))
      );
      const snippet =
        cleanData.email ||
        cleanData.name ||
        Object.values(cleanData)[0] ||
        "New submission";

      if (recipientIds.length > 0) {
        await Promise.all(
          recipientIds.map((uid) =>
            db.collection("notifications").add({
              userId: uid,
              formId,
              formName: formData.name || formId,
              dataSnippet: String(snippet).slice(0, 180),
              read: false,
              type: "submission",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            })
          )
        );
      }

      // Send email if configured
      const notifyEmail = formData.notifyEmail || formData.notificationEmail;

      if (notifyEmail) {
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                       host ? `${protocol}://${host}` : 
                       'http://localhost:3000';
        const dashboardUrl = `${baseUrl}/forms/${formId}`;

        if (process.env.NODE_ENV === 'production') {
          const emailPayload = {
            toEmail: notifyEmail,
            formData: cleanData,
            formName: formData.name || formId,
            formUrl: dashboardUrl
          };
          try {
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
          try {
            await transporter.sendMail({
              from: `"Form App" <${process.env.EMAIL_USER}>`,
              to: notifyEmail,
              subject: `New Form Submission - ${formData.name || formId}`,
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
                        <div class="form-name">${formData.name || formId}</div>
                        <a href="${dashboardUrl}" class="form-url">${dashboardUrl}</a>
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
                        <a href="${dashboardUrl}" class="btn">Go to Dashboard</a>
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
            });
            console.log(`📧 Email sent to ${notifyEmail}`);
          } catch (emailError) {
            console.error('Error sending local email:', emailError);
          }
        }
      }
    }

    // Build a friendly success message (used by embed-form.js toast)
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

// Profile Upload API
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "profile_photos",
        resource_type: "auto",
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return res.status(500).json({ error: "Cloudinary upload failed" });
        }
        res.json({ url: result.secure_url });
      }
    );

    const { Readable } = require("stream");
    const readable = new Readable();
    readable.push(req.file.buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Use multer to handle multipart/form-data (files) + regular fields
app.post("/api/forms/:formId", upload.any(), handleFormSubmit);
app.post("/api/f/:formId", upload.any(), handleFormSubmit);

/* -------------------- Serve React (Production) -------------------- */
app.use(express.static(path.join(__dirname, "build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

/* -------------------- Start Server -------------------- */

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});