import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

// Fenêtre de confirmation dessinée dans l'application (les fenêtres du navigateur
// ne s'affichent pas partout, par exemple dans une page partagée).

type Ask = { message: string; resolve: (ok: boolean) => void };
let setAsk: ((a: Ask | null) => void) | null = null;

export function askConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!setAsk) return resolve(false);
    setAsk({ message, resolve });
  });
}

export function ConfirmHost() {
  const t = useT();
  const [ask, set] = useState<Ask | null>(null);
  useEffect(() => {
    setAsk = set;
    return () => {
      setAsk = null;
    };
  }, []);
  const close = (ok: boolean) => {
    ask?.resolve(ok);
    set(null);
  };
  return (
    <AnimatePresence>
      {ask && (
        <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center bg-nuit/60 p-4 backdrop-blur-sm" onClick={() => close(false)}>
          <motion.div
            role="alertdialog"
            aria-modal="true"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="mb-4 w-full max-w-[400px] rounded-[24px] bg-coton p-5 shadow-doux"
          >
            <p className="text-[15px] leading-relaxed text-ebene">{ask.message}</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => close(false)} className="min-h-12 flex-1 rounded-full border border-or text-sm text-or-fonce">
                {t("Annuler")}
              </button>
              <button onClick={() => close(true)} className="min-h-12 flex-1 rounded-full bg-terre text-sm font-semibold text-coton">
                {t("Confirmer")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
