"use client";
import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const emulatorConnections = globalThis as typeof globalThis & {
  __assodartsAuthEmulatorConnected?: boolean;
  __assodartsFirestoreEmulatorConnected?: boolean;
};

export function isFirebaseClientConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  );
}

export function clientApp() {
  if (typeof window === "undefined") throw new Error("Firebase client is browser-only");
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    throw new Error("Firebase client configuration is missing");
  }
  return getApps()[0] ?? initializeApp({
    apiKey,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    authDomain:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
      `${projectId}.firebaseapp.com`,
    projectId,
  });
}

export function clientAuth() {
  const auth = getAuth(clientApp());
  if (
    process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "true" &&
    !emulatorConnections.__assodartsAuthEmulatorConnected
  ) {
    connectAuthEmulator(
      auth,
      `http://${process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1"}:9099`,
      { disableWarnings: true },
    );
    emulatorConnections.__assodartsAuthEmulatorConnected = true;
  }
  return auth;
}

export function clientDb() {
  const db = getFirestore(clientApp());
  if (
    process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "true" &&
    !emulatorConnections.__assodartsFirestoreEmulatorConnected
  ) {
    connectFirestoreEmulator(
      db,
      process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1",
      8080,
    );
    emulatorConnections.__assodartsFirestoreEmulatorConnected = true;
  }
  return db;
}
export const clientFunctions = () =>
  getFunctions(
    clientApp(),
    process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || "us-central1",
  );
