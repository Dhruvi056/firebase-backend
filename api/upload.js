import { v2 as cloudinary } from "cloudinary";
import Busboy from "busboy";
import { Readable } from "stream";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let fileName = "";
    let mimeType = "";

    const uploadPromise = new Promise((resolve, reject) => {
      busboy.on("file", (fieldname, file, info) => {
        const { filename, mimeType: mt } = info;
        fileName = filename;
        mimeType = mt;
        const chunks = [];
        file.on("data", (data) => chunks.push(data));
        file.on("end", () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });

      busboy.on("finish", () => resolve());
      busboy.on("error", (err) => reject(err));
    });

    req.pipe(busboy);
    await uploadPromise;

    if (!fileBuffer) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "profile_photos",
          resource_type: "auto",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      const readable = new Readable();
      readable.push(fileBuffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });

    return res.status(200).json({ url: uploadResult.secure_url });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: "Upload failed", message: error.message });
  }
}
