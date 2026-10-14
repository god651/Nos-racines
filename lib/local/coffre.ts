import type { Capsule, CapsuleItem, CapsuleRecipient, Store, User } from "@/lib/types";
import { fullName } from "@/lib/types";
import { tx } from "@/lib/i18n/core";
import { kv, mediaBlob, mutate, newId, putMedia, read } from "./store-core";
import { coffreAuthorKey, coffrePublishKey, coffreReleasedKey } from "./sync";

// ═══════════════════════════════════════════════════════════════════
// Coffres du futur.
// • Le contenu (lettres, documents, photos, voix, vidéos) est chiffré (AES-GCM 256)
//   avec une clé tirée au hasard pour chaque coffre.
// • L'auteur garde cette clé sur son téléphone ; son code (1 à 4 lettres ou chiffres)
//   ouvre le coffre pour y ajouter des choses.
// • Avec le partage en direct, la clé est confiée au « gardien » en ligne, qui ne la
//   rend aux bénéficiaires qu'à partir de la date d'ouverture (selon l'heure du serveur,
//   pas celle du téléphone : impossible de tricher en avançant la date).
// ═══════════════════════════════════════════════════════════════════

export const CODE_RE = /^[A-Z0-9]{1,4}$/;
export const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);

const b64 = (u: Uint8Array) => {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export const hashCode = (code: string, salt: string) => sha256(`coffre:${salt}:${normCode(code)}`);

const importKey = (k: string) => crypto.subtle.importKey("raw", unb64(k), "AES-GCM", false, ["encrypt", "decrypt"]);
async function newKey() {
  return b64(crypto.getRandomValues(new Uint8Array(32)));
}

async function encryptJSON(key: string, obj: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importKey(key), new TextEncoder().encode(JSON.stringify(obj)));
  return { iv: b64(iv), data: b64(new Uint8Array(data)) };
}
async function decryptJSON<T>(key: string, box: { iv: string; data: string }): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, await importKey(key), unb64(box.data));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
async function encryptBlob(key: string, blob: Blob) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importKey(key), await blob.arrayBuffer());
  return new Blob([iv, new Uint8Array(data)], { type: "application/octet-stream" });
}
async function decryptBlob(key: string, blob: Blob, mime: string) {
  const all = new Uint8Array(await blob.arrayBuffer());
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.subarray(0, 12) }, await importKey(key), all.subarray(12));
  return new Blob([plain], { type: mime });
}

// ─── Clés gardées sur ce téléphone ───
interface LocalKey {
  k: string;
  c: string;
}
const keyOf = (id: string): LocalKey | null => {
  try {
    return JSON.parse(kv.get(`nr_coffre_${id}`) ?? "null");
  } catch {
    return null;
  }
};
const saveKey = (id: string, v: LocalKey) => kv.set(`nr_coffre_${id}`, JSON.stringify(v));
/** Le code gravé sur la clé (connu seulement de l'auteur, puis des bénéficiaires le jour venu). */
export const localCode = (id: string) => keyOf(id)?.c;

// ─── Dates ───
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const openDateOf = (c: Capsule) => c.openAt ?? (c.openYear ? `${c.openYear}-01-01` : todayStr());
export const isDue = (c: Capsule) => openDateOf(c) <= todayStr();
/** Ancienne capsule (avant le coffre) : contenu en clair, sans clé. */
export const isLegacy = (c: Capsule) => !c.box && !c.codeHash;

// ─── À qui ? ───
export function isRecipient(c: Capsule, u: User | null | undefined) {
  if (!u || c.by === u.id) return false;
  if (isLegacy(c)) return true;
  return (c.to ?? []).some((r) => r.kind === "all" || (r.kind === "user" && r.id === u.id) || (r.kind === "person" && !!u.personId && r.id === u.personId));
}
export function recipientsLabel(c: Capsule) {
  if (isLegacy(c)) return c.recipients || "";
  return (c.to ?? []).map((r) => r.label).join(", ");
}

/** Propositions de bénéficiaires, calculées à partir de la place de l'auteur dans l'arbre. */
export function suggestions(s: Store, me: User): { label: string; to: CapsuleRecipient[] }[] {
  const out: { label: string; to: CapsuleRecipient[] }[] = [{ label: tx("Toute la famille"), to: [{ kind: "all", label: tx("Toute la famille") }] }];
  const pid = me.personId;
  if (!pid) return out;
  const name = (id: string) => {
    const p = s.persons.find((x) => x.id === id);
    return p && !p.placeholder ? fullName(p) : "";
  };
  const people = (ids: string[]) => [...new Set(ids)].filter((id) => name(id)).map((id) => ({ kind: "person" as const, id, label: name(id) }));
  const childrenOf = (id: string) => s.parentages.filter((p) => p.parentIds.includes(id)).map((p) => p.childId);
  const parentsOf = (id: string) => s.parentages.find((p) => p.childId === id)?.parentIds ?? [];
  const kids = childrenOf(pid);
  const grand = kids.flatMap(childrenOf);
  const spouses = s.unions.filter((u) => (u.partnerA === pid || u.partnerB === pid) && !u.separated).map((u) => (u.partnerA === pid ? u.partnerB : u.partnerA));
  const ps = parentsOf(pid);
  const sibs = ps.length ? s.parentages.filter((p) => p.childId !== pid && p.parentIds.some((x) => ps.includes(x))).map((p) => p.childId) : [];
  const add = (label: string, to: CapsuleRecipient[]) => to.length && out.push({ label, to });
  add(tx("Mes enfants"), people(kids));
  add(tx("Mes petits-enfants"), people(grand));
  add(tx("Mon conjoint"), people(spouses));
  add(tx("Mes frères et sœurs"), people(sibs));
  add(tx("Mes parents"), people(ps));
  return out;
}

// ─── Créer, ouvrir, compléter ───
export interface NewItem {
  kind: CapsuleItem["kind"];
  text?: string;
  file?: Blob;
  name?: string;
  durationSec?: number;
}

async function storeItems(key: string, by: string, items: NewItem[]): Promise<CapsuleItem[]> {
  const out: CapsuleItem[] = [];
  for (const it of items) {
    const item: CapsuleItem = { id: newId(), kind: it.kind, addedAt: Date.now(), name: it.name, durationSec: it.durationSec };
    if (it.kind === "lettre") item.text = (it.text ?? "").slice(0, 20000);
    if (it.file) {
      const mid = newId(16);
      const enc = await encryptBlob(key, it.file);
      await putMedia(mid, enc);
      item.mediaId = mid;
      item.mime = it.file.type || "application/octet-stream";
      await mutate((s) => void s.media.push({ id: mid, kind: "coffre", mime: "application/octet-stream", file: `${mid}.bin`, size: enc.size, isPublic: false, createdAt: Date.now(), by }));
    }
    out.push(item);
  }
  return out;
}

/** Scelle un nouveau coffre. Renvoie son identifiant. */
export async function sealCapsule(opts: { me: User; title?: string; openAt: string; to: CapsuleRecipient[]; code: string; items: NewItem[] }) {
  const code = normCode(opts.code);
  if (!CODE_RE.test(code)) throw new Error("Le code de la clé : 1 à 4 lettres ou chiffres.");
  if (opts.openAt <= todayStr()) throw new Error("Choisissez une date d’ouverture dans le futur.");
  if (!opts.to.length) throw new Error("Choisissez à qui le coffre est destiné.");
  if (!opts.items.length) throw new Error("Déposez au moins une chose dans le coffre.");
  const id = newId();
  const key = await newKey();
  const salt = newId(12);
  const items = await storeItems(key, opts.me.id, opts.items);
  const box = await encryptJSON(key, items);
  const codeHash = await hashCode(code, salt);
  saveKey(id, { k: key, c: code });
  await mutate((s) =>
    void s.capsules.push({
      id,
      by: opts.me.id,
      byName: s.persons.find((p) => p.id === opts.me.personId)?.givenName ?? opts.me.name,
      title: opts.title?.trim().slice(0, 80) || undefined,
      openAt: opts.openAt,
      to: opts.to,
      codeHash,
      salt,
      box,
      itemCount: items.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  // Le gardien en ligne reçoit la clé (s'il y a le partage en direct) ; sinon, ce sera au prochain tour.
  void coffrePublishKey(id, key, code, opts.openAt).catch(() => undefined);
  return id;
}

export type Opened = { capsule: Capsule; items: CapsuleItem[]; key: string; code: string };

/** Ouvre un coffre avec son code. L'auteur peut toujours ; un bénéficiaire, à partir de la date. */
export async function openCapsule(id: string, code: string, me: User): Promise<Opened> {
  const c = read().capsules.find((x) => x.id === id);
  if (!c) throw new Error("Coffre introuvable.");
  if (isLegacy(c)) {
    const items: CapsuleItem[] = [];
    if (c.text) items.push({ id: "t", kind: "lettre", text: c.text, addedAt: c.createdAt });
    if (c.mediaId) items.push({ id: "m", kind: c.kind === "video" ? "video" : "voix", mediaId: c.mediaId, mime: c.kind === "video" ? "video/webm" : "audio/webm", addedAt: c.createdAt });
    return { capsule: c, items, key: "", code: "" };
  }
  const cc = normCode(code);
  if (!c.salt || (await hashCode(cc, c.salt)) !== c.codeHash) throw new Error("Ce n’est pas le bon code.");
  const author = c.by === me.id;
  if (!author && !isDue(c)) throw new Error("Ce coffre est encore scellé.");
  if (!author && !isRecipient(c, me)) throw new Error("Ce coffre ne vous est pas destiné.");
  let key = keyOf(id)?.k;
  if (!key) key = (author ? await coffreAuthorKey(id, cc) : (await coffreReleasedKey(id))?.key) ?? undefined;
  if (!key) throw new Error(author ? "La clé de ce coffre est sur votre ancien téléphone. Activez le partage en direct pour la retrouver." : "Le coffre s’ouvrira dès que ce téléphone aura Internet.");
  saveKey(id, { k: key, c: cc });
  const items = await decryptJSON<CapsuleItem[]>(key, c.box!);
  if (!author) kv.set(`nr_coffre_vu_${id}`, "1");
  return { capsule: c, items, key, code: cc };
}

/** L'auteur ajoute des choses dans son coffre (avant ou après la date). */
export async function addToCapsule(o: Opened, me: User, add: NewItem[]) {
  if (o.capsule.by !== me.id) throw new Error("Seul l’auteur du coffre peut y ajouter des choses.");
  const more = await storeItems(o.key, me.id, add);
  const items = [...o.items, ...more];
  const box = await encryptJSON(o.key, items);
  await mutate((s) => {
    const c = s.capsules.find((x) => x.id === o.capsule.id);
    if (c) Object.assign(c, { box, itemCount: items.length, updatedAt: Date.now() });
  });
  return { ...o, items };
}

/** Retire un objet du coffre (auteur). */
export async function removeFromCapsule(o: Opened, me: User, itemId: string) {
  if (o.capsule.by !== me.id) throw new Error("Seul l’auteur du coffre peut le modifier.");
  const items = o.items.filter((i) => i.id !== itemId);
  const box = await encryptJSON(o.key, items);
  const gone = o.items.find((i) => i.id === itemId)?.mediaId;
  await mutate((s) => {
    const c = s.capsules.find((x) => x.id === o.capsule.id);
    if (c) Object.assign(c, { box, itemCount: items.length, updatedAt: Date.now() });
    if (gone) s.media = s.media.filter((m) => m.id !== gone);
  });
  return { ...o, items };
}

/** Le fichier d'un objet, déchiffré (pour l'afficher ou l'enregistrer hors de l'application). */
export async function itemFile(o: Opened, it: CapsuleItem): Promise<Blob | null> {
  if (!it.mediaId) return null;
  const b = mediaBlob(it.mediaId);
  if (!b) return null;
  if (isLegacy(o.capsule)) return b;
  return decryptBlob(o.key, b, it.mime || "application/octet-stream");
}

/** Code de la clé reçue par un bénéficiaire, le jour venu (affiché dans la notification). */
export async function releasedCode(c: Capsule): Promise<string | null> {
  const local = keyOf(c.id);
  if (local) return local.c;
  const r = await coffreReleasedKey(c.id).catch(() => null);
  return r?.code ?? null;
}

/** Après coup (partage activé plus tard) : confier au gardien les clés de mes coffres. */
export async function publishMyKeys(me: User | null) {
  if (!me) return;
  for (const c of read().capsules.filter((x) => x.by === me.id && !isLegacy(x))) {
    const k = keyOf(c.id);
    if (!k || kv.get(`nr_coffre_garde_${c.id}`) === "1") continue;
    if (await coffrePublishKey(c.id, k.k, k.c, openDateOf(c)).catch(() => false)) kv.set(`nr_coffre_garde_${c.id}`, "1");
  }
}
