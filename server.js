require("dotenv").config();
const express = require("express");
const path = require("path");
const nodemailer = require("nodemailer");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const crypto = require("crypto");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const formRoutes = require("./routes/formRoutes");
const folderRoutes = require("./routes/folderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const submissionRoutes = require("./routes/submissionRoutes");
const User = require("./models/userModel");
const Form = require("./models/formModel");
const Submission = require("./models/submissionModel");
const {
  parseNotificationEmails,
  sendSubmissionNotificationEmails,
} = require("./utils/submissionEmail");

/* -------------------- Cloudinary Setup -------------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log("Cloudinary configured:", process.env.CLOUDINARY_CLOUD_NAME ? "YES" : "NO");

const app = express();
const PORT = process.env.PORT || 3000;
connectDB();

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

app.use("/api/auth", authRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/submissions", submissionRoutes);
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

    const mongoForm = await Form.findById(formId).select("name settings").lean();

    if (mongoForm) {
      const dataMap = new Map(Object.entries(cleanData));
      await Submission.create({ form: formId, data: dataMap });

      const recipients = parseNotificationEmails(mongoForm.settings?.notificationEmail);
      const protocol = req.protocol;
      const host = req.get("host");
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : host
          ? `${protocol}://${host}`
          : "http://localhost:3000";
      const dashboardUrl = `${baseUrl}/forms/${formId}`;

      try {
        await sendSubmissionNotificationEmails({
          transporter,
          fromUser: process.env.EMAIL_USER,
          formName: mongoForm.name,
          formId,
          dashboardUrl,
          cleanData,
          recipients,
        });
      } catch (emailError) {
        console.error("Mongo submission notification email error:", emailError);
      }

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
    }

    return res.status(404).json({ error: "Form not found in MongoDB" });
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

/* -------------------- AUTHENTICATION API (Mongo-based reset) -------------------- */
// Step 1: request reset link
app.post("/api/auth/reset-password", async (req, res) => {
  const { email, origin } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    // For security, respond success even if user not found
    if (!user) {
      return res.json({ success: true, message: "If an account exists, a reset link has been sent." });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const baseUri =
      (typeof origin === "string" && origin.startsWith("http") ? origin : null) ||
      process.env.FRONTEND_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://phpstack-401163-6289434.cloudwaysapps.com"
        : "http://localhost:3001");
    const customResetLink = `${baseUri}/reset-password?token=${rawToken}`;

    // Always log link in dev to unblock testing
    if (process.env.NODE_ENV !== "production") {
      console.log("[reset-password] DEV reset link:", customResetLink);
    }

    const info = await transporter.sendMail({
      from: `"CS Formly" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset your CS Formly Password",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e1e8ed; }
            .header { background: linear-gradient(135deg, #6571ff 0%, #060c17 100%); padding: 40px 20px; text-align: center; color: white; }
            .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; margin-bottom: 5px; color: #ffffff; }
            .logo span { color: rgba(255,255,255,0.7); font-weight: 400; }
            .title { font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; margin-top: 10px; }
            .content { padding: 40px; text-align: center; }
            .text { font-size: 16px; color: #060c17; line-height: 1.6; margin-bottom: 30px; }
            .btn { display: inline-block; padding: 14px 28px; background-color: #6571ff; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 14px rgba(101, 113, 255, 0.4); }
            .footer { background-color: #f8f9fa; padding: 30px; text-align: center; font-size: 13px; color: #aeb7c5; border-top: 1px solid #edf1f7; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">CS <span>Formly</span></div>
              <div class="title">Password Reset Request</div>
            </div>
            <div class="content">
              <p class="text">Hello,</p>
              <p class="text">We received a request to reset your password for your CS Formly account. If you didn't make this request, you can safely ignore this email.</p>
              <a href="${customResetLink}" class="btn">Reset Password</a>
              <p class="text" style="margin-top: 30px; font-size: 14px; color: #7987a1;">Or copy and paste this link into your browser:<br/>
                <a href="${customResetLink}" style="color: #6571ff; word-break: break-all;">${customResetLink}</a>
              </p>
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


    return res.json({
      success: true,
      message: "Password reset email sent",
      ...(process.env.NODE_ENV !== "production" ? { devResetLink: customResetLink } : {}),
    });
  } catch (error) {
    console.error("Error generating/sending password reset link:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Step 2: confirm reset
app.post("/api/auth/reset-password/confirm", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ error: "Token and new password are required" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    }).select("+password");

    if (!user) {
      return res.status(400).json({ error: "Reset link is invalid or has expired." });
    }

    user.password = password;
    user.resetPasswordTokenHash = "";
    user.resetPasswordExpiresAt = null;
    await user.save();

    return res.json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    console.error("Error confirming password reset:", error);
    return res.status(500).json({ error: error.message });
  }
});

/* -------------------- Serve React (Production) -------------------- */
app.use(express.static(path.join(__dirname, "build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

/* -------------------- Start Server -------------------- */

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});