import { isPwa } from "@/lib/native";

// ═══════════════════════════════════════════════════════════════════
// Version iPhone : l'application web installée sur l'écran d'accueil.
// Un « service worker » garde toute l'application dans le téléphone (elle s'ouvre
// sans Internet) et va chercher les nouvelles versions publiées par le créateur.
// ═══════════════════════════════════════════════════════════════════

let waiting: ServiceWorker | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const pwaUpdateReady = () => !!waiting;
export const subscribePwa = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

let reg: ServiceWorkerRegistration | undefined;

export function startPwa() {
  if (!isPwa || !("serviceWorker" in navigator)) return;
  // Demande au téléphone de ne jamais effacer les données de la famille.
  void navigator.storage?.persist?.().catch(() => undefined);
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  void navigator.serviceWorker
    .register("./sw.js", { scope: "./" })
    .then((r) => {
      reg = r;
      const track = (w: ServiceWorker | null) => {
        if (!w) return;
        const done = () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) {
            waiting = w;
            emit();
          }
        };
        done();
        w.addEventListener("statechange", done);
      };
      track(r.waiting);
      r.addEventListener("updatefound", () => track(r.installing));
      // Au retour dans l'application, on regarde s'il y a du nouveau (au plus une fois par heure).
      let last = Date.now();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && Date.now() - last > 3600_000) {
          last = Date.now();
          void r.update().catch(() => undefined);
        }
      });
    })
    .catch(() => undefined);
}

/** Cherche tout de suite une nouvelle version. */
export async function checkPwaUpdate(): Promise<"found" | "none" | "error"> {
  if (!reg) return "error";
  try {
    await reg.update();
    await new Promise((r) => setTimeout(r, 2500));
    return waiting || reg.installing ? "found" : "none";
  } catch {
    return "error";
  }
}

/** Installe la nouvelle version : l'application se recharge, la famille reste intacte. */
export function applyPwaUpdate() {
  if (!waiting) return location.reload();
  waiting.postMessage("nr-activer");
}
