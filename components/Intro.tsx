"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { mediaUrl } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/core";
import { read } from "@/lib/local/store-core";
import { AncestorFace, DEFAULT_FACE } from "./AncestorFace";
import { Dust, Grain } from "./ambiance";
import { Logo } from "./Logo";

// Générique d'ouverture : le logo se dessine, des mots sur la famille se succèdent,
// et le visage d'un ancêtre apparaît doucement dans la lumière. Touchez pour entrer.

export const FAMILY_WORDS = [
  tx("La famille est la première maison du cœur."),
  tx("Un arbre tient debout grâce à ses racines."),
  tx("Se souvenir, c’est continuer d’aimer."),
  tx("Chaque voix compte, chaque histoire reste."),
  tx("Ce que nos anciens ont semé, nous le récoltons."),
  tx("Ensemble, nous sommes une forêt."),
  tx("Le nom que tu portes est une histoire."),
  tx("On n’oublie pas ceux qui nous ont portés."),
];

const LENGTH = 30000;

export function Intro({ onDone }: { onDone: () => void }) {
  const t = useT();
  const fam = read().family;
  const face = mediaUrl(fam?.introPhotoId) ?? DEFAULT_FACE;
  const [w, setW] = useState(() => Math.floor(Math.random() * FAMILY_WORDS.length));
  const [leaving, setLeaving] = useState(false);
  // Tailles adaptées à l'écran : visage en haut, logo en dessous, textes, sans chevauchement.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? Math.min(window.innerWidth, 440) : 390;
  const faceSize = Math.round(Math.max(150, Math.min(280, vw * 0.7, (vh * 0.34) / 1.15)));
  const logoSize = vh < 640 ? 92 : 112;

  useEffect(() => {
    const words = setInterval(() => setW((x) => (x + 1) % FAMILY_WORDS.length), 2600);
    // On reste sur le générique jusqu'à ce que la personne touche l'écran :
    // la page peut s'ouvrir en arrière-plan, le générique ne doit pas se jouer sans être vu.
    // Entrée automatique seulement après un long moment réellement à l'écran.
    let shown = 0;
    const end = setInterval(() => {
      if (document.visibilityState === "visible") shown += 1000;
      if (shown >= LENGTH) setLeaving(true);
    }, 1000);
    return () => {
      clearInterval(words);
      clearInterval(end);
    };
  }, []);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {!leaving && (
        <motion.div
          key="intro"
          role="presentation"
          onClick={() => setLeaving(true)}
          className="fixed inset-0 z-[80] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-[#0B1711] px-8 text-center text-coton"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1.1, ease: "easeInOut" } }}
        >
          {/* Aube : une lumière chaude qui monte lentement. */}
          <motion.div
            className="absolute inset-x-[-20%] bottom-[-30%] h-[80%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(230,170,90,0.35),rgba(200,161,90,0.08)_60%,transparent)]"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 5, ease: [0.2, 0.7, 0.2, 1] }}
          />
          <Dust />
          <Grain opacity={0.1} />

          <div className="relative flex flex-col items-center">
            {/* Le visage, au-dessus du logo, dans sa propre place : il ne le recouvre jamais. */}
            <div className="relative" style={{ width: faceSize, height: faceSize * 1.15, marginBottom: -faceSize * 0.12 }}>
              <AncestorFace src={face} size={faceSize} opacity={0.26} delay={1.2} className="inset-0" />
            </div>
            <Logo size={logoSize} draw />
            <motion.p
              initial={{ opacity: 0, letterSpacing: "0.6em" }}
              animate={{ opacity: 1, letterSpacing: "0.32em" }}
              transition={{ delay: 1.6, duration: 2, ease: [0.2, 0.7, 0.2, 1] }}
              className="mt-4 font-serif text-[22px] font-light text-or"
            >
              NOS RACINES
            </motion.p>
            {fam && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4, duration: 1.4 }} className="mt-2 font-main text-[22px] text-or-pale">
                {fam.name}
              </motion.p>
            )}
            <div className="mt-6 h-[64px] w-full max-w-[320px]">
              <AnimatePresence mode="wait">
                <motion.p
                  key={w}
                  initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
                  transition={{ duration: 0.9, ease: "easeInOut" }}
                  className="font-serif text-[18px] font-light italic leading-snug text-coton/85"
                >
                  {t(FAMILY_WORDS[w])}
                </motion.p>
              </AnimatePresence>
            </div>
            {face && fam?.introCaption && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: 3.2, duration: 1.5 }} className="mt-2 text-[12px] tracking-wide text-or-pale">
                {fam.introCaption}
              </motion.p>
            )}
          </div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: [0, 0.6, 0.3, 0.6] }} transition={{ delay: 3, duration: 3, repeat: Infinity }} className="absolute bottom-10 text-[11px] uppercase tracking-[3px] text-or-pale">
            {t("Touchez pour entrer")}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
