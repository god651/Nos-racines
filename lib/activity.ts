import { kv } from "@/lib/local/store-core";

// Journal des ouvertures de l'application sur CE téléphone (pour le tableau de bord du fondateur).
// Gardé dans le téléphone, 120 jours au plus ; rien n'est envoyé.

const KEY = "nr_ouvertures";
export const dayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function readOpens(): Record<string, number> {
  try {
    return JSON.parse(kv.get(KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

let last = 0;
export function logOpen() {
  // Une ouverture = un retour dans l'application après au moins une minute.
  if (Date.now() - last < 60_000) return;
  last = Date.now();
  const o = readOpens();
  const k = dayKey();
  o[k] = (o[k] ?? 0) + 1;
  const keep = Object.keys(o).sort().slice(-120);
  kv.set(KEY, JSON.stringify(Object.fromEntries(keep.map((x) => [x, o[x]]))));
}
