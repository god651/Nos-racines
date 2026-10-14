import { Capacitor } from "@capacitor/core";

// Fonctions propres à l'application Android (sans effet dans la démo web).

export const isNative = Capacitor.isNativePlatform();
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || "dev";
/** Adresse du « bulletin » des mises à jour publié par le créateur (GitHub). */
export const UPDATE_FEED: string = import.meta.env.VITE_UPDATE_FEED || "";
/** Page où télécharger l'application Android (pour l'installer chez un proche). */
export const APK_URL: string = import.meta.env.VITE_APK_URL || "";
export const RELEASES_URL: string = import.meta.env.VITE_RELEASES_URL || "";
/** Adresse de l'application pour iPhone (version web installée sur l'écran d'accueil). */
export const WEB_APP_URL: string = import.meta.env.VITE_WEB_APP_URL || "";
/** Cette page est la version installable (iPhone) publiée sur la page GitHub. */
export const isPwa = !isNative && import.meta.env.VITE_PWA === "1";
export const isIOS = typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
/** Ouverte depuis l'icône de l'écran d'accueil (et non dans un onglet de Safari). */
export const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

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
