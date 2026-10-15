import type { Store } from "@/lib/types";
import { embedded, hostSave } from "./env";
import { isNative, shareFile } from "@/lib/native";
import { getLink, setCloudLink } from "./sync";
import { empty, kv, mediaBlob, mutate, newId, putMedia, read, replaceAll, clearMedia } from "./store-core";

// Sauvegarde complète en un seul fichier (fiches + photos + voix),
// à garder ailleurs que dans le téléphone, et à restaurer sur un nouveau téléphone.

const FORMAT = "nos-racines-sauvegarde";

function toBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function fromBase64(b64: string, type: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Prépare le fichier de sauvegarde complet (fiches, liens, photos, voix, compte de ce téléphone). */
export async function buildBackup() {
  const s = read();
  const { sessions: _s, invites: allInvites, ...rest } = s;
  void _s;
  // Les invitations encore valables voyagent avec la sauvegarde : un proche qui a scanné
  // le QR code « Rejoindre » ouvre ainsi la famille avec SON compte (membre), pas en administrateur.
  const invites = allInvites.filter((i) => !i.revoked && (i.kind === "account" ? i.uses === 0 : !i.forUserId));
  const media: { id: string; mime: string; data: string }[] = [];
  for (const m of s.media) {
    const b = mediaBlob(m.id);
    if (b) media.push({ id: m.id, mime: m.mime, data: await toBase64(b) });
  }
  // Le compte ouvert sur ce téléphone : à la restauration, on rouvre CE compte.
  const me = s.sessions.find((x) => x.token === kv.get("nr_session"))?.userId;
  const data = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), me, nuage: getLink() ?? undefined, store: { ...rest, invites, settings: { ...s.settings, translateKey: undefined } }, media };
  const text = JSON.stringify(data);
  const blob = new Blob([text], { type: "application/json" });
  const name = `nos-racines-${(s.family?.name ?? "famille").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
  return { name, blob, text };
}

/** Envoie une copie de la sauvegarde ailleurs (WhatsApp, Drive, e-mail) ou la télécharge. */
export async function exportFamily() {
  const { name, blob } = await buildBackup();
  const file = new File([blob], name, { type: "application/json" });
  if (isNative) {
    try {
      await shareFile(name, blob);
    } catch (e) {
      if (!/cancel/i.test((e as Error).message ?? "")) throw e;
    }
    return;
  }
  if (embedded) {
    if (await hostSave(name, blob)) return;
    throw new Error("L’enregistrement de fichiers n’est pas possible ici.");
  }
  // Sur téléphone : feuille de partage (Fichiers, Drive, WhatsApp, e-mail) ; sinon, téléchargement.
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      kv.set("nr_sauvegarde_derniere", String(Date.now()));
      return;
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.setAttribute("download", name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}

/** Utilise une invitation (QR code « Rejoindre » ou code d'accès) : renvoie le compte ouvert, ou rien si le code n'est pas valable. */
export function applyInvite(store: Store, token: string, name?: string): string | undefined {
  const code = token.trim().toUpperCase().replace(/[^A-Z0-9_-]/gi, "");
  const inv = store.invites.find((i) => (i.token === token || (i.kind === "account" && i.token === code)) && !i.revoked);
  if (!inv || (inv.kind === "account" && inv.uses > 0)) return undefined;
  inv.uses++;
  if (inv.forUserId) return inv.forUserId;
  const id = newId();
  store.users.push({ id, name: (name || "Membre").slice(0, 60), role: "membre", createdAt: Date.now() });
  return id;
}

/** Restaure une sauvegarde : remplace la famille de ce téléphone. Ce téléphone devient administrateur. */
export async function importFamily(file: File, join?: { token: string; name?: string }) {
  let data: { format?: string; store?: Partial<Store>; media?: { id: string; mime: string; data: string }[]; nuage?: { fid: string; key: string }; me?: string };
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("Ce fichier n’est pas une sauvegarde NOS RACINES.");
  }
  if (data.format !== FORMAT || !data.store?.family) throw new Error("Ce fichier n’est pas une sauvegarde NOS RACINES.");
  const store: Store = { ...empty(), ...(data.store as Store), sessions: [] };
  store.invites = store.invites ?? [];
  // Arrivée par un QR code « Rejoindre » : on vérifie le code AVANT de toucher au téléphone.
  const joinUserId = join ? applyInvite(store, join.token, join.name) : undefined;
  if (join && !joinUserId) throw new Error("Ce QR code ne correspond pas à cette sauvegarde. Demandez une sauvegarde récente à l’administrateur.");
  await clearMedia();
  for (const m of data.media ?? []) await putMedia(m.id, fromBase64(m.data, m.mime));
  // La sauvegarde connaît l'espace en ligne de la famille : ce téléphone s'y relie.
  if (data.nuage?.fid && data.nuage.key) setCloudLink(data.nuage);
  if (joinUserId) {
    const token = newId(32);
    store.sessions.push({ token, userId: joinUserId, createdAt: Date.now() });
    kv.set("nr_session", token);
    await replaceAll(store);
    return;
  }
  // On rouvre le compte de la personne qui a fait la sauvegarde ; sinon, le premier administrateur.
  let admin = store.users.find((u) => u.id === data.me) ?? store.users.find((u) => u.role === "admin");
  if (!admin) {
    admin = { id: newId(), name: "Administrateur", role: "admin", createdAt: Date.now() };
    store.users.push(admin);
  }
  const token = newId(32);
  store.sessions.push({ token, userId: admin.id, createdAt: Date.now() });
  kv.set("nr_session", token);
  await replaceAll(store);
}

