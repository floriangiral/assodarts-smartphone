import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, openSync, closeSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = join(webDir, ".local-dev");
const statePath = join(stateDir, "server.json");
const logPath = join(stateDir, "server.log");
const lockPath = join(stateDir, "command.lock");
const nextBin = join(webDir, "node_modules/next/dist/bin/next");
const port = 3000;
const delay = (ms) => new Promise((done) => setTimeout(done, ms));

function state() {
  try {
    const value = JSON.parse(readFileSync(statePath, "utf8"));
    return Number.isInteger(value.pid) && value.pid > 1 && value.port === port ? value : null;
  } catch {
    return null;
  }
}

function managed(value) {
  if (!value) return false;
  const result = spawnSync("ps", ["-p", String(value.pid), "-o", "args="], { encoding: "utf8" });
  return result.status === 0 && result.stdout.includes(nextBin) && /(?:^|\s)dev(?:\s|$)/.test(result.stdout);
}

function removeState() {
  try { unlinkSync(statePath); } catch (error) { if (error.code !== "ENOENT") throw error; }
}

async function isPortFree() {
  return new Promise((done, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") done(false);
      else reject(error);
    });
    server.listen(port, "127.0.0.1", () => server.close(() => done(true)));
  });
}

async function ready() {
  return new Promise((done) => {
    const request = http.get({ hostname: "127.0.0.1", port, path: "/", headers: { host: `localhost:${port}` }, timeout: 1000 }, (response) => {
      response.resume();
      done(response.statusCode === 200);
    });
    request.on("error", () => done(false));
    request.on("timeout", () => request.destroy());
  });
}

async function stop() {
  const value = state();
  if (!managed(value)) {
    removeState();
    console.log("Aucun serveur géré par cette commande n'est en cours.");
    if (!(await isPortFree())) console.log(`Le port ${port} est occupé par un autre processus, laissé intact.`);
    return;
  }
  // Detached Next is the leader of its own process group; never signal another group.
  const pgid = spawnSync("ps", ["-p", String(value.pid), "-o", "pgid="], { encoding: "utf8" }).stdout.trim();
  if (pgid !== String(value.pid)) throw new Error("Groupe de processus inattendu ; arrêt refusé.");
  process.kill(-value.pid, "SIGTERM");
  for (let i = 0; i < 100; i++) {
    if (!managed(value) && await isPortFree()) {
      removeState();
      console.log("Serveur web arrêté.");
      return;
    }
    await delay(100);
  }
  throw new Error(`Arrêt non confirmé ; vérifier le PID ${value.pid} et le port ${port}.`);
}

async function start() {
  const old = state();
  if (managed(old)) {
    if (await ready()) { console.log(`Serveur déjà actif : http://localhost:${port}/ (PID ${old.pid}).`); return; }
    throw new Error(`Le serveur géré (PID ${old.pid}) ne répond pas ; consulter ${logPath} ou utiliser restart.`);
  }
  removeState();
  if (!(await isPortFree())) throw new Error(`Le port ${port} est occupé par un autre processus. Libérez-le puis réessayez ; aucun processus étranger n'a été arrêté.`);
  try { readFileSync(nextBin); } catch { throw new Error("Dépendances absentes. Depuis web/ : npm ci --ignore-scripts"); }
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const logFd = openSync(logPath, "w", 0o600);
  const child = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: webDir, env: { ...process.env, ROOT_DOMAIN: "localhost" }, detached: true, stdio: ["ignore", logFd, logFd],
  });
  closeSync(logFd);
  if (!child.pid) throw new Error("Impossible de démarrer Next.js.");
  writeFileSync(statePath, JSON.stringify({ pid: child.pid, port }) + "\n", { mode: 0o600 });
  child.unref();
  for (let i = 0; i < 300; i++) {
    if (!managed({ pid: child.pid, port })) { removeState(); throw new Error(`Le serveur s'est arrêté. Voir ${logPath}`); }
    if (await ready()) {
      console.log(`Serveur prêt : http://localhost:${port}/ (PID ${child.pid})`);
      console.log(`Journaux : ${logPath}`);
      return;
    }
    await delay(100);
  }
  throw new Error(`Le serveur n'est pas prêt après 30 secondes. Voir ${logPath} ; utilisez stop pour l'arrêter.`);
}

async function withLock(action) {
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  let fd;
  try {
    fd = openSync(lockPath, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`Une autre commande est en cours ; si elle a été interrompue, vérifiez puis supprimez ${lockPath}.`);
    throw error;
  }
  try {
    writeFileSync(fd, `${process.pid}\n`);
    await action();
  } finally {
    closeSync(fd);
    unlinkSync(lockPath);
  }
}

async function main() {
  const command = process.argv[2] ?? "status";
  if (process.argv.length > 3) throw new Error("Usage : ./web/dev {start|stop|restart|reload|status|logs}");
  if (command === "start") await withLock(start);
  else if (command === "stop") await withLock(stop);
  else if (command === "restart" || command === "reload") await withLock(async () => { await stop(); await start(); });
  else if (command === "status") {
    const current = state();
    if (managed(current)) {
      const ok = await ready();
      console.log(ok ? `Serveur actif : http://localhost:${port}/ (PID ${current.pid}).` : `Serveur présent mais pas prêt (PID ${current.pid}).`);
      if (!ok) process.exitCode = 1;
    } else {
      console.log(`Serveur arrêté${(await isPortFree()) ? "." : ` ; port ${port} occupé par un autre processus.`}`);
      process.exitCode = 1;
    }
  } else if (command === "logs") {
    try { process.stdout.write(readFileSync(logPath, "utf8")); }
    catch (error) { if (error.code === "ENOENT") console.log("Aucun journal disponible."); else throw error; }
  } else throw new Error("Usage : ./web/dev {start|stop|restart|reload|status|logs}");
}

main().catch((error) => { console.error(`Erreur : ${error.message}`); process.exitCode = 1; });
