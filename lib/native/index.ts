import { Capacitor } from "@capacitor/core";

// Fonctions propres à l'application Android (sans effet dans la démo web).

export const isNative = Capacitor.isNativePlatform();
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || "dev";
/** Adresse du « bulletin » des mises à jour publié par le créateur (GitHub). */
export const UPDATE_FEED: string = import.meta.env.VITE_UPDATE_FEED || "";
/** Page où télécharger l'application Android (pour l'installer chez un proche). */
export const APK_URL: string = import.meta.env.VITE_APK_URL || "";
export const RELEASES_URL: string = import.meta.env.VITE_RELEASES_URL || "";

export async function initNative(onBack: () => boolean) {
  if (!isNative) return;
  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([import("@capacitor/app"), import("@capacitor/status-bar"), import("@capacitor/splash-screen")]);
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#12261A" });
  } catch {}
  // Bouton « retour » d'Android : écran précédent, ou sortie depuis l'accueil.
  void App.addListener("backButton", () => {
    if (!onBack()) void App.minimizeApp();
  });
  // Retour dans l'application : le générique se rejoue.
  void App.addListener("resume", () => window.dispatchEvent(new Event("nr-resume")));
  // Sortie de l'application : on coupe le son (voir lib/background.ts).
  void App.addListener("pause", () => window.dispatchEvent(new Event("nr-pause")));
  setTimeout(() => void SplashScreen.hide(), 300);
}

/** Enregistre un fichier puis ouvre la feuille de partage d'Android (WhatsApp, Drive, e-mail…). */
export async function shareFile(name: string, blob: Blob) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
  const data = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
  const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
  await Share.share({ title: name, files: [uri] });
}

/** Ouvre une adresse Internet dans le navigateur du téléphone (l'application reste ouverte derrière). */
export function openExternal(url: string) {
  if (isNative) location.href = url;
  else window.open(url, "_blank", "noopener");
}
