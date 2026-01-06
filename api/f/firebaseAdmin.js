import admin from "firebase-admin";

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
}

export const db = admin.firestore();
