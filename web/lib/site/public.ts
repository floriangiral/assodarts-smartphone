import "server-only";
import { getFirestore } from "firebase-admin/firestore";
import { serverApp } from "@/lib/firebase/server";
import { parseHomeContent } from "./content";

export async function publishedHomeContent() {
  if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.GCLOUD_PROJECT && !process.env.GOOGLE_CLOUD_PROJECT && !process.env.FIREBASE_CONFIG && !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return null;
  try {
    const doc = await getFirestore(serverApp()).collection("site_content").doc("home_published").get();
    return parseHomeContent(doc.data());
  } catch (error) {
    console.error("Unable to load published site content", error);
    return null;
  }
}
