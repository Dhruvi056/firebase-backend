import admin from "firebase-admin";

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
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error.message);
    throw error;
  }
}

export const db = admin.firestore();
