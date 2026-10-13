import { read } from "./store";

// Traduction par Google Cloud Translation (API v2), seulement quand Internet et une clé sont disponibles.
// Les variables {n} sont protégées pour ne pas être traduites.

const ENDPOINT = "https://translation.googleapis.com/language/translate/v2";

export function translateKey() {
  return read().settings.translateKey || process.env.GOOGLE_TRANSLATE_API_KEY || "";
}

export async function isOnline(timeoutMs = 3000) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  try {
    await fetch("https://www.google.com/generate_204", { mode: "no-cors", signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    return true;
  } catch {
    return false;
  }
}

const protect = (s: string) => s.replace(/\{(\w+)\}/g, '<span translate="no">{$1}</span>');
const unprotect = (s: string) =>
  s
    .replace(/<span translate="no">\s*\{(\w+)\}\s*<\/span>/g, "{$1}")
    .replace(/&#39;/g, "’")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** Vérifie que les variables {x} ont survécu à la traduction ; sinon on garde le français. */
function safe(fr: string, out: string | undefined) {
  if (!out || !out.trim()) return fr;
  const vars = fr.match(/\{\w+\}/g) ?? [];
  return vars.every((v) => out.includes(v)) ? out : fr;
}

/** Avec une clé Google Cloud : service officiel, fiable et rapide. */
async function withKey(key: string, texts: string[], target: string, source: string) {
  const out: string[] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const r = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: batch.map(protect), target, source, format: "html" }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`GOOGLE_${r.status}`);
    const j = (await r.json()) as { data: { translations: { translatedText: string }[] } };
    out.push(...j.data.translations.map((x) => unprotect(x.translatedText)));
  }
  return out;
}

// Sans clé : le point d'accès public de Google Traduction (celui du navigateur).
// Gratuit mais limité : on envoie des paquets de lignes et on ralentit un peu entre deux envois.
const FREE = "https://translate.googleapis.com/translate_a/single";
const hide = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => `[${k.toUpperCase()}]`).replace(/\n/g, " ");
const show = (fr: string, s: string) => {
  let out = s;
  for (const v of fr.match(/\{(\w+)\}/g) ?? []) {
    const k = v.slice(1, -1);
    out = out.replace(new RegExp(`\\[\\s*${k}\\s*\\]`, "i"), v);
  }
  return out;
};

async function freeOne(text: string, target: string, source: string) {
  const url = `${FREE}?client=gtx&dt=t&sl=${source}&tl=${target}&q=${encodeURIComponent(text)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`GOOGLE_${r.status}`);
  const j = (await r.json()) as [[string, string][]];
  return (j[0] ?? []).map((x) => x[0]).join("");
}

async function free(texts: string[], target: string, source: string) {
  const out: string[] = [];
  const BATCH = 25;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH).map(hide);
    let lines: string[] = [];
    try {
      lines = (await freeOne(batch.join("\n"), target, source)).split("\n");
    } catch (e) {
      if (i === 0) throw e;
    }
    if (lines.length !== batch.length) {
      // Découpage différent : on traduit ligne par ligne.
      lines = [];
      for (const b of batch) lines.push(await freeOne(b, target, source).catch(() => ""));
    }
    out.push(...lines.map((l, k) => show(texts[i + k], l.trim())));
    await new Promise((res) => setTimeout(res, 250));
  }
  return out;
}

export async function translateMany(texts: string[], target: string, source = "fr"): Promise<string[]> {
  const key = translateKey();
  const out = key ? await withKey(key, texts, target, source) : await free(texts, target, source);
  return texts.map((fr, i) => safe(fr, out[i]));
}
