import { APP_VERSION, isNative, UPDATE_FEED } from "./index";
import { kv } from "@/lib/local/store-core";

// Mises à jour de l'application, publiées par le créateur seul (sur son GitHub).
// 1. Le téléphone lit le « bulletin » latest.json de la dernière version publiée.
// 2. S'il y a plus récent, il télécharge la nouvelle version (quelques Mo) en arrière-plan.
// 3. Elle s'installe au prochain démarrage, ou tout de suite si on le demande.
// Les données de la famille ne sont jamais touchées.

export interface Feed {
  version: string;
  notes?: string;
  bundle: string;
  minApk?: string;
  apk?: string;
}

export type UpdateState =
  | { kind: "none" }
  | { kind: "ready"; version: string; notes?: string; id: string }
  | { kind: "apk"; version: string; url: string; notes?: string }
  | { kind: "error"; message: string };

const num = (v: string) => v.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
export function newer(a: string, b: string) {
  const x = num(a);
  const y = num(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
}

/** Version en service sur ce téléphone (celle de l'installation ou de la dernière mise à jour). */
export async function currentVersion() {
  if (!isNative) return APP_VERSION;
  const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
  const cur = await CapacitorUpdater.current().catch(() => null);
  const v = cur?.bundle?.version;
  return v && v !== "builtin" ? v : APP_VERSION;
}

/** À appeler au démarrage : confirme que la version en service fonctionne (sinon retour automatique à la précédente). */
export async function confirmAppReady() {
  if (!isNative) return;
  const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
  await CapacitorUpdater.notifyAppReady().catch(() => undefined);
}

export async function checkForUpdate(): Promise<UpdateState> {
  if (!isNative || !UPDATE_FEED) return { kind: "none" };
  try {
    const r = await fetch(`${UPDATE_FEED}?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return { kind: "none" };
    const feed = (await r.json()) as Feed;
    const cur = await currentVersion();
    if (!feed.version || !newer(feed.version, cur)) return { kind: "none" };
    kv.set("nr_update_notes", JSON.stringify({ version: feed.version, notes: feed.notes ?? "" }));
    // Nouvelle version qui demande de réinstaller l'application (rare : changement de fonctions du téléphone).
    if (feed.minApk && feed.apk) {
      const { App } = await import("@capacitor/app");
      const info = await App.getInfo();
      if (newer(feed.minApk, info.version)) return { kind: "apk", version: feed.version, url: feed.apk, notes: feed.notes };
    }
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    const bundle = await CapacitorUpdater.download({ url: feed.bundle, version: feed.version });
    await CapacitorUpdater.next({ id: bundle.id });
    return { kind: "ready", version: feed.version, notes: feed.notes, id: bundle.id };
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }
}

/** Installe tout de suite la version téléchargée (l'application redémarre). */
export async function applyNow(id: string) {
  const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
  await CapacitorUpdater.set({ id });
}

/** Après une mise à jour : les nouveautés à montrer une fois. */
export async function freshNotes(): Promise<{ version: string; notes: string } | null> {
  const cur = await currentVersion();
  const seen = kv.get("nr_seen_version");
  kv.set("nr_seen_version", cur);
  if (!seen || seen === cur) return null;
  try {
    const n = JSON.parse(kv.get("nr_update_notes") ?? "null") as { version: string; notes: string } | null;
    return n && n.version === cur ? n : { version: cur, notes: "" };
  } catch {
    return { version: cur, notes: "" };
  }
}
