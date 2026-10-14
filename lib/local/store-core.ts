import type { Store } from "@/lib/types";

// ═══════════════════════════════════════════════════════════════════
// Stockage dans le téléphone (IndexedDB) : la famille (un objet JSON)
// et les photos / voix (fichiers). Tout fonctionne sans Internet.
// Si le navigateur refuse le stockage, l'application marche quand même
// en mémoire (mode démo : rien n'est gardé après fermeture).
// ═══════════════════════════════════════════════════════════════════

export const empty = (): Store => ({
  version: 2,
  family: null,
  users: [],
  sessions: [],
  invites: [],
  persons: [],
  unions: [],
  parentages: [],
  stories: [],
  memories: [],
  capsules: [],
  media: [],
  tributes: [],
  quizScores: [],
  settings: { onlineFeatures: true, defaultVisibility: "famille", language: "fr" },
  translations: {},
});

// Espace de stockage de la démo : en changeant ce nom, l'application repart à zéro
// (comme une première installation) sans toucher aux données précédentes.
const NS = "2026-10-13";
const PREFIX = `nr-${NS}:`;
const DB_NAME = `nos-racines-${NS}`;

// ─── Petites valeurs de l'appareil (session, langue, réglages) ───
const memKv = new Map<string, string>();
export const kv = {
  get(k: string): string | undefined {
    try {
      return localStorage.getItem(PREFIX + k) ?? undefined;
    } catch {
      return memKv.get(k);
    }
  },
  set(k: string, v: string) {
    memKv.set(k, v);
    try {
      localStorage.setItem(PREFIX + k, v);
    } catch {}
  },
  del(k: string) {
    memKv.delete(k);
    try {
      localStorage.removeItem(PREFIX + k);
    } catch {}
  },
};

// ─── IndexedDB ───
let db: IDBDatabase | null = null;
export let persistent = false;

function openDb(name = DB_NAME): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("data");
        req.result.createObjectStore("media");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
      setTimeout(() => resolve(null), 4000);
    } catch {
      resolve(null);
    }
  });
}

function idb<T>(store: "data" | "media", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, base: IDBDatabase | null = db): Promise<T | undefined> {
  return new Promise((resolve) => {
    if (!base) return resolve(undefined);
    try {
      const r = fn(base.transaction(store, mode).objectStore(store));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

// ─── La famille en mémoire ───
let S: Store = empty();
const urls = new Map<string, string>();
const blobs = new Map<string, Blob>();

export async function initStore() {
  db = await openDb();
  persistent = !!db;
  if (db) {
    const saved = await idb<Store>("data", "readonly", (s) => s.get("famille"));
    if (saved) S = { ...empty(), ...saved };
    // Réparation : une case « à compléter » déjà remplie (photo, dates, histoire…) redevient une vraie personne.
    for (const p of S.persons) {
      if (p.placeholder && (p.photoId || p.birthYear || p.deathYear || p.bio || p.job || p.village || p.nickname || !/ de /.test(p.givenName))) delete p.placeholder;
    }
    const keys = (await idb<IDBValidKey[]>("media", "readonly", (s) => s.getAllKeys())) ?? [];
    for (const k of keys) {
      const b = await idb<Blob>("media", "readonly", (s) => s.get(k));
      if (b) {
        blobs.set(String(k), b);
        urls.set(String(k), URL.createObjectURL(b));
      }
    }
    try {
      await navigator.storage?.persist?.();
    } catch {}
    await findLegacy();
    // Rien de créé dans cette version : on ramène directement l'ancienne famille.
    if (legacy && !S.family) await restoreLegacy();
  }
}

// ─── Familles créées avec les versions précédentes de la démo ───
// Elles étaient gardées sous l'ancien nom ; on les retrouve et on les ramène.
const OLD_DB = "nos-racines";
const OLD_PREFIX = "nr:";

export interface Legacy {
  familyName: string;
  persons: number;
}
export let legacy: Legacy | null = null;

async function findLegacy() {
  if (kv.get("legacy_done")) return;
  try {
    const dbs = (await indexedDB.databases?.()) ?? [{ name: OLD_DB }];
    if (!dbs.some((d) => d.name === OLD_DB)) return;
  } catch {}
  const old = await openDb(OLD_DB);
  if (!old) return;
  const st = await idb<Store>("data", "readonly", (s) => s.get("famille"), old);
  old.close();
  if (!st?.family) return;
  if (S.family && S.family.id === st.family.id) return;
  legacy = { familyName: st.family.name, persons: (st.persons ?? []).filter((p) => !p.placeholder).length };
}

/** Ramène la famille de l'ancienne version (fiches, photos, voix, comptes de ce téléphone). */
export async function restoreLegacy() {
  const old = await openDb(OLD_DB);
  if (!old) return;
  const st = await idb<Store>("data", "readonly", (s) => s.get("famille"), old);
  const keys = (await idb<IDBValidKey[]>("media", "readonly", (s) => s.getAllKeys(), old)) ?? [];
  const files: [string, Blob][] = [];
  for (const k of keys) {
    const b = await idb<Blob>("media", "readonly", (s) => s.get(k), old);
    if (b) files.push([String(k), b]);
  }
  old.close();
  if (!st) return;
  // Réglages de l'appareil (compte ouvert, langue, guide déjà vu…).
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith(OLD_PREFIX)) kv.set(k.slice(OLD_PREFIX.length), localStorage.getItem(k) ?? "");
    }
  } catch {}
  await clearMedia();
  for (const [id, b] of files) await putMedia(id, b);
  S = { ...empty(), ...st };
  await flush();
  kv.set("legacy_done", "1");
  legacy = null;
  refreshPages();
}

export function dismissLegacy() {
  kv.set("legacy_done", "1");
  legacy = null;
  refreshPages();
}

export const read = () => S;

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flush(), 250);
}
export async function flush() {
  clearTimeout(saveTimer);
  if (db) await idb("data", "readwrite", (s) => s.put(JSON.parse(JSON.stringify(S)), "famille"));
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => document.hidden && void flush());

// Petites valeurs gardées à côté de la famille (état du partage en direct).
export const idbGet = <T,>(key: string) => idb<T>("data", "readonly", (s) => s.get(key));
export const idbPut = (key: string, value: unknown) => idb("data", "readwrite", (s) => s.put(value, key));

// Le partage en direct est prévenu de chaque changement.
const mutateHooks = new Set<() => void>();
export const onMutate = (fn: () => void) => {
  mutateHooks.add(fn);
  return () => mutateHooks.delete(fn);
};

let queue: Promise<unknown> = Promise.resolve();
export function mutate<T>(fn: (s: Store) => T): Promise<T> {
  const run = async () => {
    const out = fn(S);
    persist();
    refreshPages();
    mutateHooks.forEach((h) => h());
    return out;
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

/** Remplace toute la famille (import d'une sauvegarde, réinitialisation). */
export async function replaceAll(next: Store) {
  S = { ...empty(), ...next };
  await flush();
  refreshPages();
  mutateHooks.forEach((h) => h());
}

/** Applique des changements reçus des autres téléphones (sans les renvoyer). */
export async function applyRemote(fn: (s: Store) => void) {
  const run = async () => {
    fn(S);
    persist();
    refreshPages();
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

// ─── Photos et voix ───
export async function putMedia(id: string, blob: Blob) {
  blobs.set(id, blob);
  urls.set(id, URL.createObjectURL(blob));
  await idb("media", "readwrite", (s) => s.put(blob, id));
}
export const mediaBlob = (id: string) => blobs.get(id);
/** Image affichée sans être gardée (portraits d'un QR code ouvert sur la page publique). */
export function showMedia(id: string, blob: Blob) {
  if (!urls.has(id)) urls.set(id, URL.createObjectURL(blob));
  refreshPages();
}
export const mediaObjectUrl = (id?: string) => (id ? urls.get(id) : undefined);
export async function clearMedia() {
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls.clear();
  blobs.clear();
  await idb("media", "readwrite", (s) => s.clear());
}

// ─── Rafraîchissement des écrans ───
let version = 0;
const listeners = new Set<() => void>();
export function refreshPages() {
  version++;
  listeners.forEach((l) => l());
}
export const getDataVersion = () => version;
export function subscribeData(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ─── Identifiants ───
export const newId = (n = 10) => {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  return [...crypto.getRandomValues(new Uint8Array(n))].map((b) => a[b % 64]).join("");
};

export function shortCode(len = 4, taken: Set<string> = new Set()) {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (;;) {
    const c = [...crypto.getRandomValues(new Uint8Array(len))].map((b) => alphabet[b % alphabet.length]).join("");
    if (!taken.has(c)) return c;
  }
}
