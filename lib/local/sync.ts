import nuage from "@/nuage.json";
import type { Store } from "@/lib/types";
import { APP_VERSION } from "@/lib/native";
import { applyRemote, idbGet, idbPut, kv, mediaBlob, newId, onMutate, putMedia, read } from "./store-core";

// ═══════════════════════════════════════════════════════════════════
// Partage en direct entre les téléphones de la famille.
// Chaque téléphone garde toute la famille (l'application marche sans Internet) ;
// quand il y a du réseau, il envoie ce qui a changé et reçoit ce que les autres ont fait.
// Les capsules du temps et les connexions restent dans chaque téléphone.
// ═══════════════════════════════════════════════════════════════════

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || nuage.url;
const KEY_ = (import.meta.env.VITE_SUPABASE_KEY as string | undefined) || nuage.key;
export const cloudAvailable = !!(URL_ && KEY_);

export interface CloudLink {
  fid: string;
  key: string;
}
export const getLink = (): CloudLink | null => {
  try {
    const v = JSON.parse(kv.get("nr_nuage") ?? "null") as CloudLink | null;
    return v?.fid && v.key ? v : null;
  } catch {
    return null;
  }
};
const setLink = (l: CloudLink | null) => (l ? kv.set("nr_nuage", JSON.stringify(l)) : kv.del("nr_nuage"));
/** Relie ce téléphone à l'espace d'une famille (sauvegarde restaurée) : tout sera comparé au prochain tour. */
export function setCloudLink(l: CloudLink) {
  setLink(l);
  kv.set("nr_nuage_seq", "0");
  shadow = new Map();
  shadowLoaded = true;
  void idbPut("nuage_ombre", []);
}
/** Texte ajouté au QR code « Rejoindre » : l'adresse de l'espace de la famille. */
export const linkSuffix = () => {
  const l = getLink();
  return l ? `@${l.fid}.${l.key}` : "";
};

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${URL_.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY_, Authorization: `Bearer ${KEY_}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(/NR_ACCES_REFUSE/.test(txt) ? "NR_ACCES_REFUSE" : `HTTP ${r.status}`);
  }
  const txt = await r.text();
  return (txt ? JSON.parse(txt) : null) as T;
}

// ─── Ce qui voyage ───
type Coll = "family" | "settings" | "translations" | "users" | "invites" | "persons" | "unions" | "parentages" | "stories" | "memories" | "media" | "tributes" | "quizScores";
const LISTS: Coll[] = ["users", "invites", "persons", "unions", "parentages", "stories", "memories", "media", "tributes", "quizScores"];
const idOf = (coll: Coll, x: Record<string, unknown>) => String(coll === "parentages" ? x.childId : x.id);

const canon = (v: unknown): string =>
  v === null || typeof v !== "object"
    ? JSON.stringify(v ?? null)
    : Array.isArray(v)
      ? `[${v.map(canon).join(",")}]`
      : `{${Object.keys(v as object)
          .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`)
          .join(",")}}`;

function records(s: Store) {
  const out = new Map<string, unknown>(); // « coll/id » → objet
  if (s.family) out.set("family/family", s.family);
  out.set("settings/settings", { ...s.settings, translateKey: undefined });
  out.set("translations/translations", s.translations);
  for (const c of LISTS) for (const x of s[c] as unknown as Record<string, unknown>[]) out.set(`${c}/${idOf(c, x)}`, x);
  return out;
}

// Dernier état connu de part et d'autre (pour n'envoyer que les différences).
let shadow = new Map<string, string>();
let shadowLoaded = false;
async function loadShadow() {
  if (shadowLoaded) return;
  const raw = await idbGet<[string, string][]>("nuage_ombre");
  shadow = new Map(raw ?? []);
  shadowLoaded = true;
}
const saveShadow = () => idbPut("nuage_ombre", [...shadow.entries()]);

// ─── État visible dans l'application ───
export interface SyncStatus {
  on: boolean;
  busy: boolean;
  last?: number;
  error?: string;
  sending?: number;
}
let status: SyncStatus = { on: false, busy: false };
const listeners = new Set<() => void>();
const setStatus = (p: Partial<SyncStatus>) => {
  status = { ...status, ...p };
  listeners.forEach((l) => l());
};
export const getSyncStatus = () => status;
export const subscribeSync = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// ─── Envoi ───
async function push(link: CloudLink) {
  const cur = records(read());
  const changes: { coll: string; id: string; data?: unknown; deleted?: boolean }[] = [];
  const newMedia: { id: string; mime: string }[] = [];
  for (const [k, v] of cur) {
    const c = canon(v);
    if (shadow.get(k) === c) continue;
    const [coll, id] = [k.slice(0, k.indexOf("/")), k.slice(k.indexOf("/") + 1)];
    changes.push({ coll, id, data: JSON.parse(c) });
    if (coll === "media" && !shadow.has(k)) newMedia.push({ id, mime: (v as { mime: string }).mime });
  }
  for (const k of shadow.keys()) if (!cur.has(k)) changes.push({ coll: k.slice(0, k.indexOf("/")), id: k.slice(k.indexOf("/") + 1), deleted: true });
  if (!changes.length) return 0;
  // Les photos et les voix d'abord, puis les fiches qui les citent.
  let i = 0;
  for (const m of newMedia) {
    const b = mediaBlob(m.id);
    setStatus({ sending: newMedia.length - i++ });
    if (!b) continue;
    await rpc("nr_put_media", { fid: link.fid, fkey: link.key, mid: m.id, mime: m.mime || b.type, b64: await toB64(b) });
  }
  setStatus({ sending: undefined });
  for (let j = 0; j < changes.length; j += 400) {
    const part = changes.slice(j, j + 400);
    await rpc("nr_push", { fid: link.fid, fkey: link.key, changes: part });
    for (const c of part) {
      const k = `${c.coll}/${c.id}`;
      if (c.deleted) shadow.delete(k);
      else shadow.set(k, canon(c.data));
    }
  }
  await saveShadow();
  return changes.length;
}

// ─── Réception ───
type Row = { coll: string; id: string; data: Record<string, unknown> | null; deleted: boolean; seq: number };
async function pull(link: CloudLink) {
  let since = Number(kv.get("nr_nuage_seq") ?? 0);
  let got = 0;
  for (;;) {
    const rows = await rpc<Row[]>("nr_pull", { fid: link.fid, fkey: link.key, since });
    if (!rows?.length) break;
    got += rows.length;
    await applyRemote((s) => {
      for (const r of rows) {
        const coll = r.coll as Coll;
        const k = `${coll}/${r.id}`;
        if (r.deleted || !r.data) {
          shadow.delete(k);
          if (LISTS.includes(coll)) (s[coll] as unknown as Record<string, unknown>[]) = (s[coll] as unknown as Record<string, unknown>[]).filter((x) => idOf(coll, x) !== r.id);
          continue;
        }
        shadow.set(k, canon(r.data));
        if (coll === "family") s.family = r.data as unknown as Store["family"];
        else if (coll === "settings") s.settings = { ...s.settings, ...(r.data as object), translateKey: s.settings.translateKey } as Store["settings"];
        else if (coll === "translations") s.translations = r.data as Store["translations"];
        else if (LISTS.includes(coll)) {
          const list = s[coll] as unknown as Record<string, unknown>[];
          const at = list.findIndex((x) => idOf(coll, x) === r.id);
          if (at >= 0) list[at] = r.data;
          else list.push(r.data);
        }
      }
    });
    since = rows[rows.length - 1].seq;
    kv.set("nr_nuage_seq", String(since));
    if (rows.length < 5000) break;
  }
  if (got) await saveShadow();
  return got;
}

/** Télécharge les photos et voix qui manquent sur ce téléphone. */
let fetchingMedia = false;
async function fetchMedia(link: CloudLink) {
  if (fetchingMedia) return;
  fetchingMedia = true;
  try {
    for (const m of read().media) {
      if (mediaBlob(m.id)) continue;
      const rows = await rpc<{ mime: string; b64: string }[]>("nr_get_media", { fid: link.fid, fkey: link.key, mid: m.id }).catch(() => []);
      if (rows?.[0]) {
        await putMedia(m.id, fromB64(rows[0].b64, rows[0].mime));
        await applyRemote(() => undefined); // rafraîchit l'écran
      }
    }
  } finally {
    fetchingMedia = false;
  }
}

async function ping(link: CloudLink) {
  const last = Number(kv.get("nr_nuage_ping") ?? 0);
  if (Date.now() - last < 3600_000) return;
  let did = kv.get("nr_appareil");
  if (!did) kv.set("nr_appareil", (did = newId(24)));
  await rpc("nr_ping", { did, fid: link.fid, fkey: link.key, version: APP_VERSION }).catch(() => undefined);
  kv.set("nr_nuage_ping", String(Date.now()));
}

let running: Promise<void> | null = null;
let again = false;
/** Un tour de synchronisation : envoyer, recevoir, compléter les médias. */
export function syncNow(): Promise<void> {
  const link = getLink();
  if (!cloudAvailable || !link) {
    setStatus({ on: false });
    return Promise.resolve();
  }
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    setStatus({ on: true, busy: true });
    try {
      await loadShadow();
      // Premier tour sur ce téléphone : on reçoit d'abord, pour ne pas écraser le travail des autres.
      if (Number(kv.get("nr_nuage_seq") ?? 0) === 0) await pull(link);
      await push(link);
      await pull(link);
      await publishPortraits(link).catch(() => undefined);
      setStatus({ busy: false, last: Date.now(), error: undefined });
      void fetchMedia(link);
      void ping(link);
    } catch (e) {
      const m = (e as Error).message;
      setStatus({ busy: false, error: m === "NR_ACCES_REFUSE" ? "refus" : "reseau" });
    } finally {
      running = null;
      if (again) {
        again = false;
        setTimeout(() => void syncNow(), 500);
      }
    }
  })();
  return running;
}

/** Démarre le partage : au lancement, à chaque changement, régulièrement, et au retour dans l'application. */
let started = false;
export function startSync() {
  if (started) return;
  started = true;
  let t: ReturnType<typeof setTimeout> | undefined;
  onMutate(() => {
    clearTimeout(t);
    t = setTimeout(() => void syncNow(), 2000);
  });
  setInterval(() => document.visibilityState === "visible" && void syncNow(), 45_000);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void syncNow());
  window.addEventListener("online", () => void syncNow());
  setStatus({ on: !!getLink() && cloudAvailable });
  void syncNow();
}

/** Le fondateur ouvre l'espace en ligne de sa famille et y envoie tout. */
export async function enableSharing() {
  if (!cloudAvailable) throw new Error("Le partage en direct n’est pas encore configuré dans cette version.");
  const link = getLink() ?? { fid: newId(20), key: newId(32) };
  await rpc("nr_create", { fid: link.fid, fkey: link.key });
  setLink(link);
  shadow = new Map();
  shadowLoaded = true;
  kv.set("nr_nuage_seq", "0");
  await syncNow();
  if (status.error) throw new Error("Pas de connexion pour le moment. Réessayez plus tard.");
}

/** Arrêter le partage sur CE téléphone (la famille reste en ligne pour les autres). */
export function leaveSharing() {
  setLink(null);
  kv.del("nr_nuage_seq");
  shadow = new Map();
  void saveShadow();
  setStatus({ on: false });
}

/** Un nouveau téléphone (QR code « Rejoindre ») reçoit toute la famille. */
export async function joinCloud(link: CloudLink) {
  if (!cloudAvailable) throw new Error("Le partage en direct n’est pas disponible dans cette version.");
  setLink(link);
  kv.set("nr_nuage_seq", "0");
  shadow = new Map();
  shadowLoaded = true;
  try {
    await pull(link);
  } catch (e) {
    setLink(null);
    throw new Error((e as Error).message === "NR_ACCES_REFUSE" ? "Ce QR code n’est plus valable." : "Pas de connexion pour le moment. Réessayez plus tard.");
  }
  setStatus({ on: true, last: Date.now() });
  void fetchMedia(link);
}

/** Statistiques du créateur (tous les téléphones). */
export async function creatorStats(pin: string) {
  if (!cloudAvailable) return null;
  return rpc<{ families: number; devices: number; active1: number; active7: number; records: number; media: number; days: { day: string; phones: number }[]; adds: { day: string; n: number }[]; versions: Record<string, number> }>("nr_creator_stats", { pin });
}

// ─── Petits outils ───
async function toB64(b: Blob) {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64: string, type: string) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type });
}

// ─── Code de reprise personnel ───
const ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const pretty = (c: string) => c.match(/.{1,4}/g)!.join("-");

/** Le code de reprise de la personne connectée (créé au besoin). Sans partage en direct : rien. */
export async function myRecoveryCode(userId: string): Promise<string | null> {
  const link = getLink();
  if (!cloudAvailable || !link) return null;
  const k = `nr_reprise_${userId}`;
  let code = kv.get(k);
  if (code) return pretty(code);
  code = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => ALPHA[b % ALPHA.length]).join("");
  await rpc("nr_set_recovery", { fid: link.fid, fkey: link.key, code, uid: userId });
  kv.set(k, code);
  return pretty(code);
}

/** Nouveau téléphone ou réinstallation : le code ramène la famille et rouvre le compte de la personne. */
export async function recoverWithCode(raw: string): Promise<string> {
  if (!cloudAvailable) throw new Error("Le partage en direct n’est pas disponible dans cette version.");
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 16) throw new Error("Le code contient 16 caractères (4 groupes de 4).");
  let rows: { fid: string; fkey: string; uid: string }[];
  try {
    rows = await rpc("nr_get_recovery", { code });
  } catch {
    throw new Error("Pas de connexion pour le moment. Réessayez plus tard.");
  }
  if (!rows?.[0]) throw new Error("Code inconnu. Vérifiez chaque caractère.");
  await joinCloud({ fid: rows[0].fid, key: rows[0].fkey });
  kv.set(`nr_reprise_${rows[0].uid}`, code);
  return rows[0].uid;
}

// ─── Portraits visibles par tous (QR codes des fiches et de l'arbre) ───
async function publishPortraits(link: CloudLink) {
  const mids = [...new Set(read().persons.filter((p) => !p.placeholder).flatMap((p) => p.photoIds ?? (p.photoId ? [p.photoId] : [])))].sort();
  const sig = mids.join(",");
  if (kv.get("nr_portraits_publics") === sig) return;
  await rpc("nr_set_public", { fid: link.fid, fkey: link.key, mids });
  kv.set("nr_portraits_publics", sig);
}

/** Identifiant de la famille en ligne (pour que les QR codes montrent les portraits). */
export const publicFamilyId = () => (cloudAvailable ? getLink()?.fid : undefined);

/** Portrait d'un QR code : lisible par n'importe qui, sans la clé de la famille. */
export async function fetchPublicPhoto(fid: string, mid: string): Promise<Blob | null> {
  if (!cloudAvailable) return null;
  try {
    const rows = await rpc<{ mime: string; b64: string }[]>("nr_public_media", { fid, mid });
    return rows?.[0] ? fromB64(rows[0].b64, rows[0].mime) : null;
  } catch {
    return null;
  }
}
