"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { navigate } from "@/lib/local/router";
import { kv } from "@/lib/local/store-core";
import { getSyncStatus, myMember, subscribeSync } from "@/lib/local/sync";

// Un nouveau membre n'est pas encore relié à sa fiche : « Qui êtes-vous dans l'arbre ? »
export function IdentifyHost({ path }: { path: string }) {
  const t = useT();
  useSyncExternalStore(subscribeSync, getSyncStatus);
  const [later, setLater] = useState(() => kv.get("nr_qui_plus_tard") === new Date().toDateString());
  const m = myMember();
  const show = path === "/accueil" && !!m && !m.person_id && !m.requested_person_id && !later;
  return (
    <AnimatePresence>
      {show && (
        <motion.div key="qui" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="fixed inset-x-0 bottom-[98px] z-[55] mx-auto max-w-[440px] px-4">
          <div className="flex items-center gap-3 rounded-[20px] border border-or/40 bg-nuit/95 py-3 pl-4 pr-2 text-coton shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur">
            <p className="min-w-0 flex-1 text-[13px] leading-snug">
              {t("Qui êtes-vous dans l’arbre ?")} <span className="text-or-pale">{t("Reliez votre compte à votre fiche.")}</span>
            </p>
            <button
              onClick={() => {
                kv.set("nr_qui_plus_tard", new Date().toDateString());
                setLater(true);
              }}
              className="px-2 text-[12px] text-or-pale/80"
            >
              {t("Plus tard")}
            </button>
            <button onClick={() => navigate("/moi/qui")} className="min-h-10 rounded-full bg-or px-4 text-[13px] font-semibold text-nuit">
              {t("Choisir")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
