export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

export function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function functionsRequire() {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  return createRequire(require.resolve("../functions/package.json"));
}

export async function loadAdminSdk(moduleNames) {
  const requireFromFunctions = await functionsRequire();
  return Object.fromEntries(
    moduleNames.map((moduleName) => [
      moduleName,
      requireFromFunctions(moduleName),
    ]),
  );
}

export async function runMain(main, failureMessage) {
  try {
    await main();
  } catch (error) {
    console.error(failureMessage);
    console.error(error);
    process.exit(1);
  }
}
