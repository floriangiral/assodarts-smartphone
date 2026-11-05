"use client";
import { getApps, initializeApp } from "firebase/app";
export function clientApp() {
  if (typeof window === "undefined") throw new Error("Firebase client is browser-only");
  return getApps()[0] ?? initializeApp({ apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
}
