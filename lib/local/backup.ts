import type { Store } from "@/lib/types";
import { embedded, hostSave } from "./env";
import { isNative, shareFile } from "@/lib/native";
import { empty, kv, mediaBlob, newId, putMedia, read, replaceAll, clearMedia } from "./store-core";

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

export async function exportFamily() {
  const s = read();
  const { sessions: _s, invites: _i, ...rest } = s;
  void _s;
  void _i;
  const media: { id: string; mime: string; data: string }[] = [];
  for (const m of s.media) {
    const b = mediaBlob(m.id);
    if (b) media.push({ id: m.id, mime: m.mime, data: await toBase64(b) });
  }
  const data = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), store: { ...rest, settings: { ...s.settings, translateKey: undefined } }, media };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const name = `nos-racines-${(s.family?.name ?? "famille").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
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
  // Sur téléphone : feuille de partage (Drive, WhatsApp, e-mail) ; sinon, téléchargement.
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
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

/** Restaure une sauvegarde : remplace la famille de ce téléphone. Ce téléphone devient administrateur. */
export async function importFamily(file: File) {
  let data: { format?: string; store?: Partial<Store>; media?: { id: string; mime: string; data: string }[] };
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("Ce fichier n’est pas une sauvegarde NOS RACINES.");
  }
  if (data.format !== FORMAT || !data.store?.family) throw new Error("Ce fichier n’est pas une sauvegarde NOS RACINES.");
  const store: Store = { ...empty(), ...(data.store as Store), sessions: [], invites: [] };
  await clearMedia();
  for (const m of data.media ?? []) await putMedia(m.id, fromBase64(m.data, m.mime));
  // On ouvre la session du premier administrateur (c'est votre sauvegarde).
  let admin = store.users.find((u) => u.role === "admin");
  if (!admin) {
    admin = { id: newId(), name: "Administrateur", role: "admin", createdAt: Date.now() };
    store.users.push(admin);
  }
  const token = newId(32);
  store.sessions.push({ token, userId: admin.id, createdAt: Date.now() });
  kv.set("nr_session", token);
  await replaceAll(store);
}
