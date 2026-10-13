"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { isNative, openExternal } from "@/lib/native";
import { applyNow, checkForUpdate, confirmAppReady, freshNotes, type UpdateState } from "@/lib/native/updates";

// Mises à jour de l'application Android : un bandeau discret quand une nouvelle version
// publiée par le créateur est prête, et un mot « Nouveautés » après l'installation.

let state: UpdateState = { kind: "none" };
const listeners = new Set<() => void>();
const set = (s: UpdateState) => {
  state = s;
  listeners.forEach((l) => l());
};
let running: Promise<UpdateState> | null = null;

/** Cherche une mise à jour (au démarrage, au retour dans l'application, ou depuis les paramètres). */
export function lookForUpdate(): Promise<UpdateState> {
  if (!running) {
    running = checkForUpdate().then((s) => {
      if (s.kind !== "error" && (s.kind !== "none" || state.kind === "none")) set(s);
      running = null;
      return s;
    });
  }
  return running;
}

export function UpdateHost({ blocked }: { blocked: boolean }) {
  const t = useT();
  const [s, setS] = useState<UpdateState>(state);
  const [hidden, setHidden] = useState(false);
  const [notes, setNotes] = useState<{ version: string; notes: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const l = () => {
      setS(state);
      setHidden(false);
    };
    listeners.add(l);
    if (!isNative) return () => void listeners.delete(l);
    void confirmAppReady();
    void freshNotes().then(setNotes);
    const first = setTimeout(() => void lookForUpdate(), 4000);
    // Au retour dans l'application, on regarde de nouveau (au plus une fois par heure).
    let last = Date.now();
    const again = () => {
      if (Date.now() - last > 3600_000) {
        last = Date.now();
        void lookForUpdate();
      }
    };
    window.addEventListener("nr-resume", again);
    return () => {
      listeners.delete(l);
      clearTimeout(first);
      window.removeEventListener("nr-resume", again);
    };
  }, []);

  if (blocked) return null;

  return (
    <AnimatePresence>
      {notes && (
        <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[72] flex items-end justify-center bg-[rgba(8,16,11,0.6)] px-4 pb-8" onClick={() => setNotes(null)}>
          <motion.div initial={{ y: 40 }} animate={{ y: 0 }} className="w-full max-w-[420px] rounded-[26px] bg-coton p-5 text-ebene" onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] uppercase tracking-[2px] text-or-fonce">{t("Version {v}", { v: notes.version })}</p>
            <h2 className="mt-1 font-serif text-[23px] text-nuit">{t("Nouveautés")}</h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-[#3E3A32]">{notes.notes || t("L’application a été mise à jour. Votre famille, vos photos et vos voix sont intactes.")}</p>
            <button onClick={() => setNotes(null)} className="mt-4 min-h-11 w-full rounded-full bg-foret text-[14px] font-semibold text-coton">{t("Merci")}</button>
          </motion.div>
        </motion.div>
      )}
      {!notes && !hidden && (s.kind === "ready" || s.kind === "apk") && (
        <motion.div key="bar" initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }} className="fixed inset-x-0 top-0 z-[65] mx-auto max-w-[440px] px-3 pt-[max(10px,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3 rounded-[20px] border border-or/40 bg-nuit/95 px-4 py-3 text-coton shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">{t("Nouvelle version prête")}</p>
              <p className="truncate text-[12px] text-or-pale">{s.notes || t("Version {v}", { v: s.version })}</p>
            </div>
            <button onClick={() => setHidden(true)} className="text-[12px] text-or-pale/80">{t("Plus tard")}</button>
            {s.kind === "ready" ? (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await applyNow(s.id).catch(() => setBusy(false));
                }}
                className="min-h-10 rounded-full bg-or px-4 text-[13px] font-semibold text-nuit"
              >
                {busy ? "…" : t("Installer")}
              </button>
            ) : (
              <button onClick={() => openExternal(s.url)} className="min-h-10 rounded-full bg-or px-4 text-[13px] font-semibold text-nuit">
                {t("Télécharger")}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
