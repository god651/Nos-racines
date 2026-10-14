import { sound } from "./sound";

// Quand on quitte l'application (bouton d'accueil, autre application, écran éteint),
// plus aucun son : l'ambiance s'arrête et les voix en cours se mettent en pause.
// Au retour, seule l'ambiance reprend ; une voix ne repart pas toute seule.

const playing = new Set<HTMLMediaElement>();

export function startBackgroundGuard() {
  if (typeof window === "undefined") return;
  // On garde la trace de tous les lecteurs audio, même ceux qui ne sont pas affichés.
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    playing.add(this);
    this.addEventListener("ended", () => playing.delete(this), { once: true });
    return orig.call(this);
  };
  const sleep = () => {
    sound.sleep();
    playing.forEach((m) => {
      if (!(m instanceof HTMLVideoElement)) m.pause();
    });
    document.querySelectorAll("audio").forEach((a) => a.pause());
  };
  const wake = () => sound.wake();
  document.addEventListener("visibilitychange", () => (document.visibilityState === "hidden" ? sleep() : wake()));
  window.addEventListener("pagehide", sleep);
  window.addEventListener("blur", () => document.visibilityState === "hidden" && sleep());
  window.addEventListener("nr-pause", sleep);
  window.addEventListener("nr-resume", wake);
}
