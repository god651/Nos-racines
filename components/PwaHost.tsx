"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { kv } from "@/lib/local/store-core";
import { APK_URL, isIOS, isPwa, isStandalone } from "@/lib/native";
import { applyPwaUpdate, pwaUpdateReady, subscribePwa } from "@/lib/pwa";
import { Logo } from "./Logo";

// Version iPhone : le guide pour l'installer sur l'écran d'accueil, et le bandeau des mises à jour.

function ShareIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v9A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 17.5 9H16" />
      <path d="M12 3v12M8.5 6.5 12 3l3.5 3.5" />
    </svg>
  );
}
function AddIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

export function PwaHost({ blocked }: { blocked: boolean }) {
  const t = useT();
  const ready = useSyncExternalStore(subscribePwa, pwaUpdateReady, () => false);
  const [later, setLater] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState(() => isPwa && !isStandalone() && kv.get("nr_guide_installation") !== "1");
  if (!isPwa) return null;

  const skip = () => {
    kv.set("nr_guide_installation", "1");
    setGuide(false);
  };

  return (
    <>
      <AnimatePresence>
        {guide && (
          <motion.div key="guide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[95] overflow-y-auto bg-nuit text-coton" role="dialog" aria-modal="true">
            <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(40px,env(safe-area-inset-top))]">
              <div className="flex flex-col items-center text-center">
                <Logo size={58} />
                <p className="mt-3 font-serif text-xs tracking-[5px] text-or">NOS RACINES</p>
                <h1 className="mt-4 font-serif text-[27px] font-light leading-tight">{isIOS ? t("Installer l’application sur votre iPhone") : t("Installer l’application")}</h1>
                <p className="mt-2 text-[14px] leading-relaxed text-or-pale">{t("Trois gestes, une seule fois. Ensuite, Nos Racines s’ouvre depuis son icône, en plein écran, même sans Internet.")}</p>
              </div>

              {isIOS ? (
                <ol className="mt-7 space-y-3">
                  {[
                    { icon: <ShareIcon />, text: t("Touchez le bouton Partager de Safari, en bas de l’écran (en haut sur iPad).") },
                    { icon: <AddIcon />, text: t("Descendez un peu, puis touchez « Sur l’écran d’accueil ».") },
                    { icon: <span className="font-serif text-[15px]">OK</span>, text: t("Touchez « Ajouter ». Ouvrez ensuite Nos Racines depuis sa nouvelle icône.") },
                  ].map((s, i) => (
                    <motion.li key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.15 }} className="flex items-center gap-4 rounded-[20px] border border-or/25 bg-coton/5 p-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-or text-nuit">{s.icon}</span>
                      <span className="text-[14px] leading-snug">
                        <b className="mr-1 text-or">{i + 1}.</b>
                        {s.text}
                      </span>
                    </motion.li>
                  ))}
                </ol>
              ) : (
                <div className="mt-7 space-y-3">
                  {APK_URL && (
                    <a href={APK_URL} className="flex min-h-12 items-center justify-center rounded-full bg-or text-[15px] font-semibold text-nuit">
                      {t("Télécharger l’application Android")}
                    </a>
                  )}
                  <p className="text-center text-[13px] leading-relaxed text-or-pale">{t("Ou, dans le menu du navigateur, touchez « Installer l’application » ou « Ajouter à l’écran d’accueil ».")}</p>
                </div>
              )}

              <p className="mt-6 rounded-[16px] bg-or/10 p-3.5 text-[12px] leading-relaxed text-or-pale">
                {t("Important : installez-la avant de commencer. Ce que vous ajoutez ici, dans le navigateur, ne passe pas dans l’application installée.")}
              </p>

              {isIOS && (
                <motion.div className="mt-auto flex flex-col items-center pt-8 text-or" animate={{ y: [0, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
                  <ShareIcon size={26} />
                  <svg width="18" height="22" viewBox="0 0 18 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mt-1" aria-hidden>
                    <path d="M9 2v17M3 13l6 6 6-6" />
                  </svg>
                </motion.div>
              )}
              <button onClick={skip} className={`${isIOS ? "mt-4" : "mt-auto pt-8"} min-h-11 text-[13px] text-or-pale/70 underline underline-offset-4`}>
                {t("Continuer dans le navigateur")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!blocked && ready && !later && (
          <motion.div key="maj" initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }} className="fixed inset-x-0 top-0 z-[65] mx-auto max-w-[440px] px-3 pt-[max(10px,env(safe-area-inset-top))]">
            <div className="flex items-center gap-3 rounded-[20px] border border-or/40 bg-nuit/95 px-4 py-3 text-coton shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">{t("Nouvelle version prête")}</p>
                <p className="truncate text-[12px] text-or-pale">{t("Votre famille, vos photos et vos voix restent intactes.")}</p>
              </div>
              <button onClick={() => setLater(true)} className="text-[12px] text-or-pale/80">
                {t("Plus tard")}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  applyPwaUpdate();
                }}
                className="min-h-10 rounded-full bg-or px-4 text-[13px] font-semibold text-nuit"
              >
                {busy ? "…" : t("Mettre à jour")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
