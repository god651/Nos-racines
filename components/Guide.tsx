"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/core";
import { kv } from "@/lib/local/store-core";
import { sound } from "@/lib/sound";
import { Logo } from "./Logo";

// Visite guidée pour les nouveaux utilisateurs : quelques cartes, avec un halo
// qui montre où toucher dans la barre du bas. Une seule fois par compte ; à revoir depuis « Moi ».

const KEY = (userId: string) => `nr_guide_${userId}`;
export const guideSeen = (userId: string) => !!kv.get(KEY(userId));
export const markGuide = (userId: string, seen: boolean) => (seen ? kv.set(KEY(userId), "1") : kv.del(KEY(userId)));

interface Step {
  title: string;
  text: string;
  /** Rang de l'onglet à montrer dans la barre du bas (0 à 4). */
  nav?: number;
  logo?: boolean;
}

const COMMON: Step[] = [
  { logo: true, title: tx("Bienvenue dans NOS RACINES"), text: tx("Ici vivent les visages, les voix et les histoires de votre famille. Voici en un instant comment s’y retrouver.") },
  { nav: 0, title: tx("L’accueil"), text: tx("Les photos de famille défilent, les compteurs grandissent avec l’arbre, et chaque jour une voix ou un récit vous attend. Les anniversaires y sont rappelés.") },
  { nav: 1, title: tx("L’arbre"), text: tx("Faites glisser pour vous promener, touchez un portrait pour ouvrir sa fiche. Le bouton carré montre tout l’arbre d’un coup. Les défunts ont leur mémorial « Yako ».") },
  { nav: 2, title: tx("Raconter"), text: tx("Le grand bouton doré : les anciens racontent, on garde leur voix pour toujours. On peut aussi écrire un récit ou importer un message vocal.") },
  { nav: 3, title: tx("Le Griot et le quiz"), text: tx("Posez une question sur la famille, le Griot répond à partir des fiches. Le quiz vous fait gagner des points : qui sera en tête du classement ?") },
  { nav: 4, title: tx("Votre espace"), text: tx("Votre fiche, vos capsules pour le futur, les QR codes, la langue et les paramètres.") },
];

export function Guide({ userId, isAdmin, onDone }: { userId: string; isAdmin: boolean; onDone: () => void }) {
  const t = useT();
  const steps: Step[] = [
    ...COMMON,
    isAdmin
      ? { title: t("Vous êtes administrateur"), text: t("Le bouton + de l’arbre ajoute une personne en choisissant son lien : père, tante, cousin… L’arbre se range tout seul.") }
      : { title: t("Vous êtes membre"), text: t("Vous voyez tout et pouvez jouer, écouter, allumer une bougie ou laisser un mot. Pour modifier l’arbre, le fondateur peut vous en donner le droit.") },
  ];
  const [i, setI] = useState(0);
  const [hole, setHole] = useState<DOMRect | null>(null);
  const step = steps[i];

  // Position de l'onglet à montrer (calculée sur l'écran réel).
  useLayoutEffect(() => {
    if (step.nav === undefined) return setHole(null);
    const find = () => {
      const items = document.querySelectorAll("nav[data-main-nav] > a");
      const el = items[step.nav!] as HTMLElement | undefined;
      setHole(el ? el.getBoundingClientRect() : null);
    };
    find();
    window.addEventListener("resize", find);
    return () => window.removeEventListener("resize", find);
  }, [step.nav]);

  useEffect(() => {
    sound.play("chime");
  }, [i]);

  const finish = () => {
    markGuide(userId, true);
    onDone();
  };
  const next = () => (i + 1 >= steps.length ? finish() : setI(i + 1));

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={t("Guide de l’application")}>
      {/* Voile sombre, percé là où il faut toucher. */}
      {hole ? (
        <motion.div
          className="absolute rounded-full"
          initial={false}
          animate={{ left: hole.left + hole.width / 2 - 34, top: hole.top + hole.height / 2 - 34, width: 68, height: 68 }}
          transition={{ type: "spring", stiffness: 160, damping: 22 }}
          style={{ boxShadow: "0 0 0 9999px rgba(8,16,11,0.78)" }}
        >
          <span className="nr-ripple absolute inset-0 rounded-full border-2 border-or" />
        </motion.div>
      ) : (
        <motion.div className="absolute inset-0 bg-[rgba(8,16,11,0.82)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      )}

      <div className="absolute inset-x-0 mx-auto max-w-[440px] px-5" style={{ bottom: hole ? Math.max(120, window.innerHeight - hole.top + 24) : "28%" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
            className="rounded-[26px] border border-or/30 bg-coton p-5 text-ebene shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
          >
            {step.logo && (
              <div className="mb-3 flex justify-center">
                <Logo size={72} />
              </div>
            )}
            <p className="text-[11px] uppercase tracking-[2px] text-or-fonce">{t("Étape {n} sur {m}", { n: i + 1, m: steps.length })}</p>
            <h2 className="mt-1 font-serif text-[23px] leading-tight text-nuit">{t(step.title)}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[#3E3A32]">{t(step.text)}</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex flex-1 gap-1">
                {steps.map((_, k) => (
                  <span key={k} className={`h-1.5 rounded-full transition-all duration-500 ${k === i ? "w-5 bg-or" : "w-1.5 bg-or-pale"}`} />
                ))}
              </div>
              <button onClick={finish} className="text-[13px] text-[#6B6455]">{t("Passer")}</button>
              <button onClick={next} className="min-h-11 rounded-full bg-foret px-5 text-[14px] font-semibold text-coton">
                {i + 1 >= steps.length ? t("C’est parti") : t("Suivant")}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
