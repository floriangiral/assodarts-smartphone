import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(webDir, "../backend");
const dir = join(webDir, ".local-dev");
const stateFile = join(dir, "demo-emulator.json");
const logFile = join(dir, "demo-emulator.log");
const javaFile = join(dir, "demo-java-home");
const project = "demo-assodarts-web";
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
function readState() {
  try {
    return JSON.parse(readFileSync(stateFile, "utf8"));
  } catch {
    return null;
  }
}
function alive(s) {
  if (!Number.isInteger(s?.pid) || s.pid < 2) return false;
  const ps = spawnSync("ps", ["-p", String(s.pid), "-o", "args="], {
    encoding: "utf8",
  });
  return (
    ps.status === 0 &&
    ps.stdout.includes("firebase") &&
    ps.stdout.includes("emulators:start") &&
    ps.stdout.includes(project)
  );
}
function portFree() {
  return new Promise((done) => {
    const s = net.createServer();
    s.once("error", () => done(false));
    s.listen(8080, "127.0.0.1", () => s.close(() => done(true)));
  });
}
function ready() {
  return new Promise((done) => {
    const r = http.get(
      { hostname: "127.0.0.1", port: 8080, path: "/", timeout: 1000 },
      (res) => {
        res.resume();
        done(true);
      },
    );
    r.on("error", () => done(false));
    r.on("timeout", () => r.destroy());
  });
}
function command(program, args, env) {
  const r = spawnSync(program, args, { cwd: webDir, env, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${program} a échoué.`);
}
async function stopEmulator() {
  const state = readState();
  if (!alive(state)) {
    if (existsSync(stateFile)) unlinkSync(stateFile);
    return;
  }
  const pgid = spawnSync("ps", ["-p", String(state.pid), "-o", "pgid="], {
    encoding: "utf8",
  }).stdout.trim();
  if (pgid !== String(state.pid))
    throw new Error("Groupe d'émulateur inattendu ; arrêt refusé.");
  process.kill(-state.pid, "SIGTERM");
  for (let i = 0; i < 100; i++) {
    if (!alive(state) && (await portFree())) {
      unlinkSync(stateFile);
      return;
    }
    await sleep(100);
  }
  throw new Error("L'arrêt de l'émulateur n'est pas confirmé.");
}
async function start() {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  let state = readState();
  if (!alive(state)) {
    if (!(await portFree()))
      throw new Error(
        "Le port 8080 est occupé par un autre processus ; libérez-le pour lancer la démonstration.",
      );
    const javaHome =
      process.env.JAVA_HOME ||
      (existsSync(javaFile) ? readFileSync(javaFile, "utf8").trim() : "");
    const java = javaHome ? join(javaHome, "bin") : "";
    const env = {
      ...process.env,
      PATH: java ? `${java}:${process.env.PATH}` : process.env.PATH,
    };
    if (spawnSync("java", ["-version"], { env, stdio: "ignore" }).status !== 0)
      throw new Error(
        "Java 21 est requis : configurez JAVA_HOME ou ajoutez java au PATH.",
      );
    if (javaHome) writeFileSync(javaFile, `${javaHome}\n`, { mode: 0o600 });
    const fd = openSync(logFile, "w", 0o600);
    const child = spawn(
      "npx",
      [
        "--yes",
        "firebase-tools@15.35.0",
        "emulators:start",
        "--config",
        join(backend, "firebase.json"),
        "--only",
        "firestore",
        "--project",
        project,
      ],
      { cwd: dir, env, detached: true, stdio: ["ignore", fd, fd] },
    );
    closeSync(fd);
    if (!child.pid) throw new Error("Impossible de lancer l'émulateur.");
    state = { pid: child.pid };
    writeFileSync(stateFile, JSON.stringify(state) + "\n", { mode: 0o600 });
    child.unref();
    for (let i = 0; i < 300; i++) {
      if (await ready()) break;
      if (!alive(state))
        throw new Error(`L'émulateur s'est arrêté ; voir ${logFile}.`);
      await sleep(100);
    }
    if (!(await ready()))
      throw new Error(`L'émulateur n'est pas prêt ; voir ${logFile}.`);
  }
  const env = {
    ...process.env,
    GCLOUD_PROJECT: project,
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  };
  command(process.execPath, [join(webDir, "scripts/seed-demo.mjs")], env);
  command(join(webDir, "dev"), ["restart"], env);
  console.log(
    "\nPages :\n  Vitrine : http://localhost:3000/\n  Club : http://localhost:3000/?club=club-a\n  Agenda : http://localhost:3000/agenda?club=club-a\n  Événement : http://localhost:3000/e/tournoi-decouverte?club=club-a\n  Responsables : http://admin.localhost:3000/",
  );
}
const action = process.argv[2] || "start";
try {
  if (action === "start" || action === "restart") {
    if (action === "restart") {
      command(join(webDir, "dev"), ["stop"], process.env);
      await stopEmulator();
    }
    await start();
  } else if (action === "stop") {
    command(join(webDir, "dev"), ["stop"], process.env);
    await stopEmulator();
    console.log("Démonstration arrêtée.");
  } else if (action === "status") {
    const state = readState();
    console.log(
      alive(state) && (await ready())
        ? `Émulateur actif (PID ${state.pid}).`
        : "Émulateur arrêté.",
    );
    command(join(webDir, "dev"), ["status"], process.env);
  } else throw new Error("Usage : ./web/demo {start|stop|restart|status}");
} catch (error) {
  console.error(`Erreur : ${error.message}`);
  process.exitCode = 1;
}
