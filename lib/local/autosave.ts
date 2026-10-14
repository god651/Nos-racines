import { isNative, isPwa } from "@/lib/native";
import { buildBackup } from "./backup";
import { kv, onMutate, read } from "./store-core";

// ═══════════════════════════════════════════════════════════════════
// Sauvegarde du téléphone dans UN fichier toujours au même endroit :
//   Documents/NosRacines/nos-racines-sauvegarde.json
// Ce dossier n'est pas effacé quand on désinstalle l'application : après une
// réinstallation (ou sur un autre téléphone, en copiant le fichier), on le rouvre
// et tout revient, là où on s'était arrêté.
// Mode « automatique » : le fichier est mis à jour tout seul après chaque ajout.
// Mode « manuel » : une petite notification propose de sauvegarder.
// ═══════════════════════════════════════════════════════════════════

export type SaveMode = "auto" | "manuel";
export const DIR = "NosRacines";
const DEFAULT_FILE = "nos-racines-sauvegarde.json";

export const getMode = (): SaveMode => (kv.get("nr_sauvegarde_mode") === "manuel" ? "manuel" : "auto");
export const setMode = (m: SaveMode) => {
  kv.set("nr_sauvegarde_mode", m);
  emit();
};
export const lastSaved = () => Number(kv.get("nr_sauvegarde_derniere") ?? 0) || undefined;
export const backupPath = () => `Documents/${DIR}/${kv.get("nr_sauvegarde_fichier") ?? DEFAULT_FILE}`;
/** Le fichier au même endroit n'existe que dans l'application Android. */
export const fileBackupAvailable = isNative;

// ─── Ce qui a changé depuis la dernière sauvegarde ───
// Empreinte de la famille (sans les connexions) : se connecter n'est pas « ajouter une information ».
const fingerprint = () => {
  const { sessions: _s, ...rest } = read();
  void _s;
  const t = JSON.stringify(rest);
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return `${t.length}:${h}`;
};

export interface SaveState {
  pending: boolean; // une information ajoutée n'est pas encore sauvegardée
  ask: boolean; // la petite notification est affichée
  busy: boolean;
  justSaved?: number;
  error?: string;
}
let state: SaveState = { pending: false, ask: false, busy: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (p: Partial<SaveState>) => {
  state = { ...state, ...p };
  emit();
};
export const getSaveState = () => state;
export const subscribeSave = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

async function writeFile(text: string) {
  const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
  try {
    const p = await Filesystem.checkPermissions();
    if (p.publicStorage !== "granted") await Filesystem.requestPermissions();
  } catch {}
  const name = kv.get("nr_sauvegarde_fichier") ?? DEFAULT_FILE;
  try {
    await Filesystem.writeFile({ path: `${DIR}/${name}`, data: text, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
  } catch {
    // Après une réinstallation, Android ne laisse pas réécrire l'ancien fichier :
    // on en commence un nouveau à côté (l'ancien reste là, intact).
    const alt = `nos-racines-sauvegarde-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}.json`;
    await Filesystem.writeFile({ path: `${DIR}/${alt}`, data: text, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
    kv.set("nr_sauvegarde_fichier", alt);
  }
}

let lastPrint = "";
/** Sauvegarde maintenant dans le fichier du téléphone. */
export async function saveNow(): Promise<boolean> {
  if (!read().family) return false;
  if (!fileBackupAvailable) {
    set({ pending: false, ask: false });
    return false;
  }
  set({ busy: true, ask: false, error: undefined });
  try {
    const { text } = await buildBackup();
    await writeFile(text);
    lastPrint = fingerprint();
    kv.set("nr_sauvegarde_derniere", String(Date.now()));
    set({ busy: false, pending: false, justSaved: Date.now() });
    return true;
  } catch (e) {
    set({ busy: false, error: (e as Error).message || "Sauvegarde impossible." });
    return false;
  }
}

export const dismissAsk = () => set({ ask: false });

let started = false;
export function startAutosave() {
  if (started) return;
  started = true;
  lastPrint = fingerprint();
  let t: ReturnType<typeof setTimeout> | undefined;
  onMutate(() => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (!read().family) return;
      const fp = fingerprint();
      if (fp === lastPrint) return;
      if (isPwa) {
        // Sur iPhone, pas de fichier qui se met à jour tout seul : tout reste dans le téléphone,
        // et tous les trois jours au plus, une petite notification propose d'en garder une copie dans Fichiers.
        lastPrint = fp;
        const asked = Number(kv.get("nr_sauvegarde_demande") ?? 0);
        const saved = lastSaved() ?? 0;
        if (Date.now() - Math.max(asked, saved) < 3 * 86400000) return;
        kv.set("nr_sauvegarde_demande", String(Date.now()));
        set({ pending: true, ask: true });
      } else if (getMode() === "auto") {
        set({ pending: true });
        void saveNow();
      } else {
        lastPrint = fp; // on ne redemande pas pour la même information
        set({ pending: true, ask: true });
      }
    }, 2500);
  });
  // En quittant l'application, ce qui attend part dans le fichier (mode automatique).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && state.pending && getMode() === "auto") void saveNow();
  });
}
