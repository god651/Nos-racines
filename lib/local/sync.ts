import type { Role, Store, User } from "@/lib/types";
import { APP_VERSION } from "@/lib/native";
import { cloudAvailable as CLOUD, downloadMedia, getSession, myUid, publicPortraitUrl, rpc, supa, uploadMedia } from "@/lib/cloud";
import { applyRemote, idbGet, idbPut, kv, mediaBlob, newId, onMutate, putMedia, read, refreshPages, replaceAll } from "./store-core";

// ═══════════════════════════════════════════════════════════════════
// La famille unique, en ligne, partagée en temps réel.
// Le téléphone garde une copie (l'application marche sans Internet) ; la base centrale
// est la référence. Chaque fiche a un numéro de version : si deux personnes modifient
// la même fiche en même temps, le téléphone fusionne champ par champ au lieu d'écraser.
// Le serveur vérifie le rôle de chacun (administrateur, éditeur, lecteur) pour chaque fiche.
// ═══════════════════════════════════════════════════════════════════

export const cloudAvailable = CLOUD;

export interface CloudLink {
  fid: string;
  uid: string;
}
export const getLink = (): CloudLink | null => {
  try {
    const v = JSON.parse(kv.get("nr_famille_en_ligne") ?? "null") as CloudLink | null;
    return v?.fid && v.uid && v.uid === myUid() ? v : null;
  } catch {
    return null;
  }
};
const setLink = (l: CloudLink | null) => (l ? kv.set("nr_famille_en_ligne", JSON.stringify(l)) : kv.del("nr_famille_en_ligne"));
/** Ancienne sauvegarde : le lien n'y voyage plus (chaque personne se connecte avec son compte). */
export function setCloudLink(_l: unknown) {}
/** Le QR code « Rejoindre » en ligne contient seulement le code d'invitation. */
export const linkSuffix = () => "";

// ─── Ce qui voyage ───
type Coll = "family" | "settings" | "translations" | "persons" | "unions" | "parentages" | "stories" | "memories" | "media" | "tributes" | "quizScores" | "capsules";
const LISTS = ["persons", "unions", "parentages", "stories", "memories", "media", "tributes", "quizScores", "capsules"] as const;
type ListColl = (typeof LISTS)[number];
const isList = (c: string): c is ListColl => (LISTS as readonly string[]).includes(c);
const idOf = (coll: string, x: Record<string, unknown>) => String(coll === "parentages" ? x.childId : x.id);

export const canon = (v: unknown): string =>
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
const split = (k: string) => [k.slice(0, k.indexOf("/")), k.slice(k.indexOf("/") + 1)] as const;

/** Fusion à trois voies, champ par champ : ce que j'ai changé + ce que l'autre a changé.
 *  Si nous avons changé le même champ, la version du serveur l'emporte (elle est arrivée la première). */
export function merge3(base: Record<string, unknown> | null, mine: Record<string, unknown>, theirs: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...theirs };
  const b = base ?? {};
  for (const k of new Set([...Object.keys(mine), ...Object.keys(b)])) {
    const mineChanged = canon(mine[k]) !== canon(b[k]);
    const theirsChanged = canon(theirs[k]) !== canon(b[k]);
    if (mineChanged && !theirsChanged) {
      if (mine[k] === undefined) delete out[k];
      else out[k] = mine[k];
    }
  }
  return out;
}

// ─── Dernier état connu du serveur, fiche par fiche (contenu + version) ───
type Shadow = Map<string, { c: string; rev: number }>;
let shadow: Shadow = new Map();
let shadowFid = "";
async function loadShadow(fid: string) {
  if (shadowFid === fid) return;
  const raw = await idbGet<[string, { c: string; rev: number }][]>(`ombre_${fid}`);
  shadow = new Map(raw ?? []);
  shadowFid = fid;
}
const saveShadow = () => idbPut(`ombre_${shadowFid}`, [...shadow.entries()]);
const seqKey = (fid: string) => `nr_seq_${fid}`;

// ─── État visible dans l'application ───
export interface SyncStatus {
  on: boolean;
  busy: boolean;
  live?: boolean;
  last?: number;
  error?: string;
  sending?: number;
  refused?: number;
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

// ─── Les membres (comptes) de la famille ───
export interface CloudMember {
  user_id: string;
  name: string;
  role: "admin" | "editeur" | "lecteur";
  status: "actif" | "en_attente";
  person_id: string | null;
  requested_person_id: string | null;
  self_edited_at: string | null;
  joined_at: string;
  creator: boolean;
  owner: boolean;
}
let members: CloudMember[] = [];
export const getMembers = () => members;
export const myMember = () => members.find((m) => m.user_id === myUid()) ?? null;
const ROLE: Record<CloudMember["role"], Role> = { admin: "admin", editeur: "editeur", lecteur: "membre" };

/** Les comptes de la famille deviennent les « utilisateurs » de l'application ; ce téléphone ouvre le mien. */
export async function refreshMembers() {
  const link = getLink();
  if (!link) return;
  members = await rpc<CloudMember[]>("nr_members", { fid: link.fid });
  const active = members.filter((m) => m.status === "actif");
  await applyRemote((s) => {
    const old = new Map(s.users.map((u) => [u.id, u]));
    s.users = active.map<User>((m) => ({
      id: m.user_id,
      name: m.name || old.get(m.user_id)?.name || "Membre",
      role: ROLE[m.role],
      personId: m.person_id ?? undefined,
      creator: m.creator || undefined,
      createdAt: Date.parse(m.joined_at) || Date.now(),
    }));
    const owner = members.find((m) => m.owner);
    if (s.family && owner) s.family.ownerId = owner.user_id;
    s.invites = [];
    let sess = s.sessions.find((x) => x.userId === link.uid);
    if (!sess) {
      sess = { token: newId(24), userId: link.uid, createdAt: Date.now() };
      s.sessions = [sess];
    } else s.sessions = [sess];
    kv.set("nr_session", sess.token);
  });
  listeners.forEach((l) => l());
}

// ─── Envoi ───
async function push(fid: string): Promise<number> {
  let sent = 0;
  for (let round = 0; round < 4; round++) {
    const cur = records(read());
    const changes: { coll: string; id: string; data?: unknown; deleted?: boolean; base_rev?: number }[] = [];
    const newMedia: string[] = [];
    for (const [k, v] of cur) {
      const c = canon(v);
      const sh = shadow.get(k);
      if (sh?.c === c) continue;
      const [coll, id] = split(k);
      changes.push({ coll, id, data: JSON.parse(c), base_rev: sh?.rev });
      if (coll === "media" && !sh) newMedia.push(id);
    }
    for (const [k, sh] of shadow) if (!cur.has(k) && sh.c !== "null" && !k.startsWith("_")) changes.push({ coll: split(k)[0], id: split(k)[1], deleted: true, base_rev: sh.rev });
    if (!changes.length) return sent;

    // Les photos, voix et vidéos d'abord, puis les fiches qui les citent.
    let i = 0;
    for (const mid of newMedia) {
      const b = mediaBlob(mid);
      setStatus({ sending: newMedia.length - i++ });
      if (b) await uploadMedia(`${fid}/${mid}`, b);
    }
    setStatus({ sending: undefined });

    let refused = 0;
    const conflicts: { coll: string; id: string; rev: number; data: Record<string, unknown> | null; deleted: boolean }[] = [];
    for (let j = 0; j < changes.length; j += 200) {
      const part = changes.slice(j, j + 200);
      const res = await rpc<{ ok: { coll: string; id: string; rev: number }[]; conflicts: typeof conflicts; denied: typeof conflicts }>("nr_write", { fid, changes: part });
      for (const o of res.ok) {
        const c = part.find((x) => x.coll === o.coll && x.id === o.id)!;
        shadow.set(`${o.coll}/${o.id}`, { c: c.deleted ? "null" : canon(c.data), rev: o.rev });
        sent++;
      }
      conflicts.push(...res.conflicts);
      // Refusé par le serveur (rôle) : on remet la version de la famille.
      if (res.denied.length) {
        refused += res.denied.length;
        await applyRemote((s) => {
          for (const d of res.denied) {
            setLocal(s, d.coll, d.id, d.deleted || !d.data ? null : d.data);
            if (d.rev) shadow.set(`${d.coll}/${d.id}`, { c: d.deleted || !d.data ? "null" : canon(d.data), rev: d.rev });
            else shadow.delete(`${d.coll}/${d.id}`);
          }
        });
      }
    }
    if (refused) setStatus({ refused });
    await saveShadow();
    if (!conflicts.length) return sent;
    // Quelqu'un d'autre a modifié les mêmes fiches : fusion, puis on renvoie au tour suivant.
    await applyRemote((s) => {
      for (const c of conflicts) {
        const k = `${c.coll}/${c.id}`;
        const base = shadow.get(k);
        const mine = records(s).get(k) as Record<string, unknown> | undefined;
        const theirs = c.deleted ? null : c.data;
        if (theirs && mine) setLocal(s, c.coll, c.id, merge3(base && base.c !== "null" ? JSON.parse(base.c) : null, mine, theirs));
        else if (theirs && !mine) setLocal(s, c.coll, c.id, theirs); // supprimée ici, modifiée ailleurs : on la garde
        shadow.set(k, { c: theirs ? canon(theirs) : "null", rev: c.rev });
      }
    });
  }
  return sent;
}

function setLocal(s: Store, coll: string, id: string, data: Record<string, unknown> | null) {
  if (coll === "family") {
    if (data) s.family = { ...(data as unknown as Store["family"] & object), ownerId: s.family?.ownerId ?? (data.ownerId as string | undefined) } as Store["family"];
  } else if (coll === "settings") {
    if (data) s.settings = { ...s.settings, ...(data as object), translateKey: s.settings.translateKey } as Store["settings"];
  } else if (coll === "translations") {
    if (data) s.translations = data as Store["translations"];
  } else if (isList(coll)) {
    const list = s[coll] as unknown as Record<string, unknown>[];
    const at = list.findIndex((x) => idOf(coll, x) === id);
    if (!data) {
      if (at >= 0) list.splice(at, 1);
    } else if (at >= 0) list[at] = data;
    else list.push(data);
  }
}

// ─── Réception ───
type Row = { coll: string; id: string; data: Record<string, unknown> | null; deleted: boolean; rev: number; seq: number };
async function pull(fid: string) {
  let since = Number(kv.get(seqKey(fid)) ?? 0);
  let got = 0;
  let membersChanged = false;
  for (;;) {
    const rows = await rpc<Row[]>("nr_pull", { fid, since });
    if (!rows?.length) break;
    got += rows.length;
    await applyRemote((s) => {
      const mineNow = records(s);
      for (const r of rows) {
        if (r.coll.startsWith("_")) {
          membersChanged = true;
          continue;
        }
        const k = `${r.coll}/${r.id}`;
        const sh = shadow.get(k);
        if (sh && sh.rev >= r.rev) continue; // déjà connu (c'est peut-être mon propre envoi)
        const theirs = r.deleted || !r.data ? null : r.data;
        const local = mineNow.get(k) as Record<string, unknown> | undefined;
        const localChanged = local !== undefined && canon(local) !== (sh?.c ?? "");
        if (localChanged && theirs && local) setLocal(s, r.coll, r.id, merge3(sh && sh.c !== "null" ? JSON.parse(sh.c) : null, local, theirs));
        else if (!(localChanged && !theirs)) setLocal(s, r.coll, r.id, theirs);
        shadow.set(k, { c: theirs ? canon(theirs) : "null", rev: r.rev });
      }
    });
    since = rows[rows.length - 1].seq;
    kv.set(seqKey(fid), String(since));
    if (rows.length < 5000) break;
  }
  if (got) await saveShadow();
  if (membersChanged || !members.length) await refreshMembers();
  return got;
}

/** Télécharge les photos, voix et vidéos qui manquent sur ce téléphone. */
let fetchingMedia = false;
async function fetchMedia(fid: string) {
  if (fetchingMedia) return;
  fetchingMedia = true;
  try {
    for (const m of read().media) {
      if (mediaBlob(m.id)) continue;
      const b = await downloadMedia(`${fid}/${m.id}`).catch(() => null);
      if (b) {
        await putMedia(m.id, b.type ? b : new Blob([b], { type: m.mime }));
        refreshPages();
      }
    }
  } finally {
    fetchingMedia = false;
  }
}

/** Portraits visibles par ceux qui scannent le QR code d'une fiche (même sans être de la famille). */
async function publishPortraits(fid: string) {
  const done = new Set((kv.get(`nr_portraits_${fid}`) ?? "").split(",").filter(Boolean));
  const mids = [...new Set(read().persons.filter((p) => !p.placeholder).flatMap((p) => p.photoIds ?? (p.photoId ? [p.photoId] : [])))];
  let changed = false;
  for (const mid of mids) {
    if (done.has(mid)) continue;
    const b = mediaBlob(mid);
    if (!b) continue;
    await uploadMedia(`${fid}/${mid}`, b, "portraits");
    done.add(mid);
    changed = true;
  }
  if (changed) kv.set(`nr_portraits_${fid}`, [...done].join(","));
}

async function ping(fid: string) {
  const last = Number(kv.get("nr_nuage_ping") ?? 0);
  if (Date.now() - last < 3600_000) return;
  let did = kv.get("nr_appareil");
  if (!did) kv.set("nr_appareil", (did = newId(24)));
  await rpc("nr_ping", { did, fid, version: APP_VERSION }).catch(() => undefined);
  kv.set("nr_nuage_ping", String(Date.now()));
}

let running: Promise<void> | null = null;
let again = false;
/** Un tour : recevoir, envoyer, recevoir, compléter les médias. */
export function syncNow(): Promise<void> {
  const link = getLink();
  if (!CLOUD || !link || !getSession()) {
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
      await loadShadow(link.fid);
      await pull(link.fid);
      await push(link.fid);
      await pull(link.fid);
      setStatus({ busy: false, last: Date.now(), error: undefined });
      void fetchMedia(link.fid);
      void publishPortraits(link.fid).catch(() => undefined);
      void ping(link.fid);
    } catch (e) {
      const m = (e as Error).message;
      setStatus({ busy: false, error: /rôle/.test(m) ? "refus" : "reseau" });
    } finally {
      running = null;
      if (again) {
        again = false;
        setTimeout(() => void syncNow(), 300);
      }
    }
  })();
  return running;
}

// ─── Temps réel ───
let channel: ReturnType<ReturnType<typeof supa>["channel"]> | null = null;
let channelFid = "";
function listen(fid: string) {
  if (channelFid === fid && channel) return;
  if (channel) void supa().removeChannel(channel);
  channelFid = fid;
  let t: ReturnType<typeof setTimeout> | undefined;
  channel = supa()
    .channel(`famille-${fid}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "nr_records", filter: `family_id=eq.${fid}` }, () => {
      clearTimeout(t);
      t = setTimeout(() => void syncNow(), 250);
    })
    .subscribe((st) => setStatus({ live: st === "SUBSCRIBED" }));
}
function stopListening() {
  if (channel) void supa().removeChannel(channel);
  channel = null;
  channelFid = "";
  setStatus({ live: false });
}

/** Démarre le partage : au lancement, à chaque changement, en temps réel, et au retour dans l'application. */
let started = false;
export function startSync() {
  if (started || !CLOUD) return;
  started = true;
  let t: ReturnType<typeof setTimeout> | undefined;
  onMutate(() => {
    clearTimeout(t);
    t = setTimeout(() => void syncNow(), 800);
  });
  // Filet de sécurité si le temps réel est coupé (réseau mobile capricieux).
  setInterval(() => document.visibilityState === "visible" && void syncNow(), 60_000);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void syncNow());
  window.addEventListener("online", () => void syncNow());
  const l = getLink();
  if (l && getSession()) {
    listen(l.fid);
    void syncNow();
  }
}

// ─── Ouvrir une famille sur ce téléphone ───

/** Relie ce téléphone (et ce compte) à une famille en ligne, puis reçoit tout l'arbre.
 *  Si le téléphone avait une AUTRE famille, elle est d'abord mise de côté (sauvegarde). */
export async function connectFamily(fid: string) {
  const uid = myUid();
  if (!uid) throw new Error("Connectez-vous d’abord à votre compte.");
  const s = read();
  if (s.family && s.family.id !== fid) {
    await idbPut(`famille_avant_${s.family.id}`, JSON.parse(JSON.stringify(s)));
    await replaceAll({ ...s, family: null, users: [], sessions: [], invites: [], persons: [], unions: [], parentages: [], stories: [], memories: [], capsules: [], media: [], tributes: [], quizScores: [], translations: {} });
  }
  setLink({ fid, uid });
  await loadShadow(fid);
  setStatus({ on: true, busy: true });
  try {
    await pull(fid);
    await refreshMembers();
    // Une famille déjà dans ce téléphone (même identifiant) : ce qui manque en ligne est envoyé,
    // selon le rôle de chacun (le reste revient à la version de la famille).
    await push(fid);
    await pull(fid);
    setStatus({ busy: false, last: Date.now(), error: undefined });
  } catch (e) {
    setStatus({ busy: false, error: "reseau" });
    throw e;
  }
  listen(fid);
  startSync();
  void fetchMedia(fid);
}

/** Créer la famille en ligne : une nouvelle, ou celle qui était déjà dans ce téléphone (mise en ligne). */
export async function enableSharing() {
  if (!CLOUD) throw new Error("La base en ligne n’est pas encore configurée dans cette version.");
  const s = read();
  if (!s.family) throw new Error("Créez d’abord la famille.");
  // Les anciens comptes de ce téléphone : chacun retrouvera sa fiche et son rôle en rejoignant.
  const legacy = s.users.map((u) => ({ id: u.id, name: u.name, role: u.role, personId: u.personId }));
  const meLocal = s.users.find((u) => u.id === s.sessions.find((x) => x.token === kv.get("nr_session"))?.userId);
  try {
    await rpc("nr_create_family", { fid: s.family.id, fname: s.family.name, legacy, me_person: meLocal?.personId ?? null });
  } catch (e) {
    if (/rôle/.test((e as Error).message)) throw new Error("Cette famille est déjà en ligne. Demandez à un administrateur le QR code « Rejoindre » pour y entrer avec votre compte.");
    throw e;
  }
  await connectFamily(s.family.id);
}

/** Quitter la famille en ligne sur CE téléphone (le compte reste membre). */
export function leaveSharing() {
  setLink(null);
  stopListening();
  members = [];
  setStatus({ on: false });
}

/** Ce que le téléphone sait du compte avant même d'avoir ouvert une famille. */
export interface MeInfo {
  user: { id: string; display_name: string; creator: boolean };
  families: { family_id: string; name: string; role: CloudMember["role"]; status: CloudMember["status"]; person_id: string | null; requested_person_id: string | null; owner: boolean }[];
}
export const fetchMe = () => rpc<MeInfo>("nr_me");

/** Rejoindre avec un code d'invitation (QR code ou tapé). */
export async function joinWithCode(code: string) {
  const legacy = read().sessions.find((x) => x.token === kv.get("nr_session"))?.userId;
  const r = await rpc<{ family_id: string }>("nr_join", { c: code, legacy_user: legacy ?? null });
  await connectFamily(r.family_id);
  return r.family_id;
}

/** Demander à rejoindre avec l'identifiant familial (un administrateur accepte). */
export const requestJoin = (joinCode: string) => rpc<{ family_id: string; name: string }>("nr_request_join", { join_code: joinCode });

// ─── Gestion de la famille (administrateurs) ───
const fidOrThrow = () => {
  const l = getLink();
  if (!l) throw new Error("Ce téléphone n’est relié à aucune famille en ligne.");
  return l.fid;
};
export const familyInfo = () => rpc<{ family_id: string; name: string; join_code: string | null }>("nr_family_info", { fid: fidOrThrow() });
export interface CloudInvitation {
  code: string;
  role: "editeur" | "lecteur";
  person_id: string | null;
  label: string | null;
  created_at: string;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
}
export const createInvitation = (o: { role: "editeur" | "lecteur"; personId?: string; label?: string; days?: number }) =>
  rpc<string>("nr_create_invitation", { fid: fidOrThrow(), role: o.role, person_id: o.personId ?? null, max_uses: null, days: o.days ?? 30, label: o.label ?? null });
export const listInvitations = () => rpc<CloudInvitation[]>("nr_invitations_list", { fid: fidOrThrow() });
export const revokeInvitation = (code: string) => rpc("nr_revoke_invitation", { c: code });
export async function setMember(uid: string, p: { role?: CloudMember["role"]; personId?: string; accept?: boolean; clearPerson?: boolean }) {
  await rpc("nr_set_member", { fid: fidOrThrow(), uid, role: p.role ?? null, person_id: p.personId ?? null, accept: p.accept ?? null, clear_person: p.clearPerson ?? false });
  await refreshMembers();
}
export async function removeMember(uid: string) {
  await rpc("nr_remove_member", { fid: fidOrThrow(), uid });
  await refreshMembers();
}
/** « C'est moi dans l'arbre » (un administrateur valide). */
export async function claimPerson(personId: string) {
  await rpc("nr_claim_person", { fid: fidOrThrow(), pid: personId });
  await refreshMembers();
}
export interface AuditEntry {
  id: number;
  at: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  coll: string | null;
  record_id: string | null;
  label: string | null;
  fields: string[] | null;
}
export const history = (beforeId?: number) => rpc<AuditEntry[]>("nr_history", { fid: fidOrThrow(), before_id: beforeId ?? null, n: 60 });

/** Statistiques du créateur (tous les téléphones). */
export async function creatorStats(pin: string) {
  if (!CLOUD) return null;
  return rpc<{ families: number; users?: number; devices: number; active1: number; active7: number; records: number; media: number; days: { day: string; phones: number }[]; adds: { day: string; n: number }[]; versions: Record<string, number> }>("nr_creator_stats", { pin });
}
export const claimCreator = (pin: string) => rpc<boolean>("nr_claim_creator", { pin });

// ─── Plus de code de reprise : on retrouve tout en se connectant à son compte ───
export async function myRecoveryCode(_userId: string): Promise<string | null> {
  return null;
}
export async function recoverWithCode(_raw: string): Promise<string> {
  throw new Error("Connectez-vous avec votre e-mail et votre mot de passe : la famille revient toute seule.");
}

// ─── Portraits des QR codes ───
export const publicFamilyId = () => (CLOUD ? getLink()?.fid : undefined);
export async function fetchPublicPhoto(fid: string, mid: string): Promise<Blob | null> {
  if (!CLOUD) return null;
  try {
    const r = await fetch(publicPortraitUrl(fid, mid));
    return r.ok ? await r.blob() : null;
  } catch {
    return null;
  }
}

// ─── Gardien des coffres du futur ───
export async function coffrePublishKey(cid: string, ckey: string, code: string, openAt: string): Promise<boolean> {
  const link = getLink();
  if (!CLOUD || !link) return false;
  await rpc("nr_coffre_put", { fid: link.fid, cid, open_at: openAt, ckey, code });
  return true;
}
export async function coffreAuthorKey(cid: string, code: string): Promise<string | null> {
  const link = getLink();
  if (!CLOUD || !link) return null;
  const rows = await rpc<{ ckey: string }[]>("nr_coffre_author", { fid: link.fid, cid, code }).catch(() => []);
  return rows?.[0]?.ckey ?? null;
}
export async function coffreReleasedKey(cid: string): Promise<{ key: string; code: string } | null> {
  const link = getLink();
  if (!CLOUD || !link) return null;
  const rows = await rpc<{ ckey: string; code: string }[]>("nr_coffre_get", { fid: link.fid, cid });
  return rows?.[0] ? { key: rows[0].ckey, code: rows[0].code } : null;
}
