"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { dismissAsk, fileBackupAvailable, getSaveState, saveNow, subscribeSave } from "@/lib/local/autosave";
import { exportFamily } from "@/lib/local/backup";

// Notification légère après un ajout : « Sauvegarder ? » (mode manuel),
// ou un petit « Sauvegardé » qui s'efface (mode automatique).
export function SaveHost({ blocked }: { blocked: boolean }) {
  const t = useT();
  const s = useSyncExternalStore(subscribeSave, getSaveState);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!s.justSaved) return;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 2200);
    return () => clearTimeout(id);
  }, [s.justSaved]);
  if (blocked) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[98px] z-[60] mx-auto flex max-w-[440px] justify-center px-4">
      <AnimatePresence>
        {s.ask && (
          <motion.div
            key="ask"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            className="pointer-events-auto flex w-full items-center gap-3 rounded-[20px] border border-or/40 bg-nuit/95 py-2.5 pl-4 pr-2 text-coton shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur"
          >
            <span className="min-w-0 flex-1 text-[13px] leading-snug">
              {t("Information ajoutée.")} <span className="text-or-pale">{t("La sauvegarder ?")}</span>
            </span>
            <button onClick={dismissAsk} className="px-2 text-[12px] text-or-pale/80">
              {t("Plus tard")}
            </button>
            <button
              onClick={() => (fileBackupAvailable ? void saveNow() : (dismissAsk(), void exportFamily().catch(() => undefined)))}
              className="min-h-9 rounded-full bg-or px-4 text-[13px] font-semibold text-nuit"
            >
              {t("Sauvegarder")}
            </button>
          </motion.div>
        )}
        {!s.ask && (flash || s.busy) && (
          <motion.div key="ok" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-full bg-nuit/85 px-3.5 py-1.5 text-[12px] text-or-pale shadow backdrop-blur">
            {s.busy ? t("Sauvegarde…") : `✓ ${t("Sauvegardé")}`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
