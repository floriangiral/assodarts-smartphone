#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function extractExportedFunctions(indexPath) {
  const source = fs.readFileSync(indexPath, "utf8");
  const exported = new Set();
  const exportBlockPattern = /export\s*\{([\s\S]*?)\}\s*from\s*["'][^"']+["'];?/g;
  let match;

  while ((match = exportBlockPattern.exec(source)) !== null) {
    const block = match[1]
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    for (const rawPart of block.split(",")) {
      const part = rawPart.trim();
      if (!part) continue;
      const aliasMatch = part.match(/\s+as\s+([A-Za-z_$][\w$]*)$/);
      exported.add(aliasMatch ? aliasMatch[1] : part);
    }
  }

  return [...exported].sort();
}

function extractDeployedFunctions(jsonPath) {
  const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const functions = Array.isArray(parsed) ? parsed : parsed.result;
  if (!Array.isArray(functions)) {
    throw new Error("Firebase functions JSON must be an array or contain a result array");
  }
  return [...new Set(functions.map((item) => item.id).filter(Boolean))].sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

const repoRoot = path.resolve(__dirname, "..", "..");
const indexPath = path.resolve(
  readArg("--index", path.join(repoRoot, "backend/functions/src/index.ts")),
);
const functionsJsonPath = path.resolve(readArg("--functions-json"));

const exported = extractExportedFunctions(indexPath);
const deployed = extractDeployedFunctions(functionsJsonPath);
const missing = difference(exported, deployed);
const extra = difference(deployed, exported);

console.log(`Exported functions (${exported.length}): ${exported.join(", ")}`);
console.log(`Deployed functions (${deployed.length}): ${deployed.join(", ")}`);

if (missing.length || extra.length) {
  if (missing.length) {
    console.error(`Missing deployed functions: ${missing.join(", ")}`);
  }
  if (extra.length) {
    console.error(`Extra deployed functions: ${extra.join(", ")}`);
  }
  process.exit(1);
}

console.log("Deployed functions match backend/functions/src/index.ts exports.");
