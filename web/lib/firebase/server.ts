import "server-only";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
export function serverApp() { return getApps()[0] ?? initializeApp({ credential: applicationDefault() }); }
