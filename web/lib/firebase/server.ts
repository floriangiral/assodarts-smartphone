import "server-only";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
export function serverApp() {
  return getApps()[0] ?? initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}
