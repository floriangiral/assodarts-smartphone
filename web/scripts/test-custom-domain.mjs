import { spawn } from "node:child_process";
import { createServer, request } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { join } from "node:path";

if (!process.env.FIRESTORE_EMULATOR_HOST || !String(process.env.GCLOUD_PROJECT ?? "").startsWith("demo-")) {
  throw new Error("Ce test exige l'émulateur Firestore et un projet demo- ; aucune donnée réelle ne doit être utilisée.");
}
const port = 3101;
const available = await new Promise((resolve) => {
  const s = createServer();
  s.once("error", () => resolve(false));
  s.listen(port, "127.0.0.1", () => s.close(() => resolve(true)));
});
if (!available) throw new Error(`Le port ${port} est occupé ; aucun processus n'a été arrêté.`);
const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const doc = getFirestore(app).collection("domains").doc("club.example");
await doc.set({ clubId: "4aee74c1-377c-40a3-a69c-74c6be749c63" });
const child = spawn(process.execPath, [join(process.cwd(), "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: process.cwd(), detached: true, stdio: "ignore", env: { ...process.env, ROOT_DOMAIN: "localhost" },
});
async function get(host) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port, path: "/", headers: { host }, timeout: 5000 }, (res) => {
      let body = ""; res.setEncoding("utf8"); res.on("data", (part) => { body += part; }); res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject); req.on("timeout", () => req.destroy(new Error("timeout"))); req.end();
  });
}
try {
  let up = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await get(`localhost:${port}`)).status === 200) { up = true; break; } } catch { /* startup */ }
    await delay(200);
  }
  if (!up) throw new Error("Le serveur de test n'a pas démarré.");
  const known = await get("club.example");
  const unknown = await get("unknown.example");
  if (known.status !== 200 || !known.body.includes("Page du club") || unknown.status !== 404) {
    throw new Error(`Résultats inattendus : connu ${known.status}, inconnu ${unknown.status}`);
  }
  console.log("Domaine connu : 200 ; domaine inconnu : 404 (émulateur Firestore).");
} finally {
  if (child.pid) { try { process.kill(-child.pid, "SIGTERM"); } catch { /* already stopped */ } }
  await doc.delete();
  await deleteApp(app);
}
