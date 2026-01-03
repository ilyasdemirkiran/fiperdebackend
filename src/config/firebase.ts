import admin from "firebase-admin";
import { env } from "./env";
import { readFileSync } from "fs";

let firebaseApp: admin.app.App | null = null;

export function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    const serviceAccount = JSON.parse(
      readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf-8")
    );

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("✅ Firebase Admin SDK initialized");
    return firebaseApp;
  } catch (error) {
    console.error("❌ Failed to initialize Firebase Admin SDK:", error);
    throw error;
  }
}

export async function verifyFirebaseToken(token: string) {
  try {
    const app = firebaseApp || initializeFirebase();
    const decodedToken = await app.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error("❌ Token verification failed:", error);
    throw new Error("Invalid authentication token");
  }
}

export function getFirebaseApp() {
  if (!firebaseApp) {
    throw new Error("Firebase not initialized. Call initializeFirebase() first.");
  }
  return firebaseApp;
}
