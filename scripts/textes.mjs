// Liste toutes les phrases françaises de l'interface (clés de traduction)
// et signale celles qui manquent dans le dictionnaire anglais (lib/i18n/en.ts).
// Usage : node scripts/textes.mjs [--json]
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|mjs)$/.test(f)) files.push(p);
  }
};
["app", "components", "lib"].forEach((d) => walk(path.join(root, d)));

const keys = new Set();
const str = String.raw`"((?:[^"\\]|\\.)*)"`;
const patterns = ["t", "tx", "fail"].map((f) => new RegExp(String.raw`\b${f}\(\s*` + str, "g"));
for (const f of files) {
  if (f.endsWith(path.join("i18n", "en.ts"))) continue;
  const src = readFileSync(f, "utf8");
  for (const re of patterns) for (const m of src.matchAll(re)) keys.add(JSON.parse(`"${m[1]}"`));
}

const en = readFileSync(path.join(root, "lib/i18n/en.ts"), "utf8");
const have = new Set([...en.matchAll(new RegExp(String.raw`^\s*` + str + String.raw`\s*:`, "gm"))].map((m) => JSON.parse(`"${m[1]}"`)));
const missing = [...keys].filter((k) => !have.has(k)).sort();
const unused = [...have].filter((k) => !keys.has(k)).sort();
if (process.argv.includes("--json")) console.log(JSON.stringify(missing, null, 1));
else {
  console.log(`${keys.size} phrases, ${missing.length} sans anglais, ${unused.length} inutilisées.`);
  missing.forEach((k) => console.log("  manque : " + k));
  unused.forEach((k) => console.log("  inutile : " + k));
}
process.exitCode = missing.length ? 1 : 0;
