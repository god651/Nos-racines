"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { LANGS } from "@/lib/i18n/core";
import { useLang, useT } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/core";
import type { Lang } from "@/lib/types";
import { Dust, Grain, Vignette } from "@/components/ambiance";
import { Waveform } from "@/components/Waveform";

const SLIDES = [
  { title: tx("Chaque famille possède un trésor."), text: tx("Des visages, des voix, des histoires. Rassemblez-les avant qu’ils ne s’effacent.") },
  { title: tx("Préservez votre histoire avant qu’elle ne disparaisse."), text: tx("Quatre générations, un seul fil. Celui que vous tenez aujourd’hui.") },
  { title: tx("Transformez votre arbre en mémoire vivante."), text: tx("Un QR code sous chaque visage. Un téléphone suffit pour l’entendre à nouveau.") },
  { title: tx("Conservez les voix qui ont construit votre famille."), text: tx("Les anciens racontent, l’application garde tout pour les enfants de demain.") },
];
const DURATION = 7000;
const ease = [0.2, 0.7, 0.2, 1] as const;

export default function Onboarding() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [langNote, setLangNote] = useState<string | null>(null);
  const [langBusy, setLangBusy] = useState<Lang | null>(null);

  async function chooseLang(code: Lang) {
    setLangBusy(code);
    setLangNote(null);
    try {
      const r = await api<{ status: string }>("/api/langue", "POST", { lang: code });
      if (r.status === "offline") setLangNote(t("Connexion Internet nécessaire la première fois pour traduire l’application dans cette langue. Le français s’affiche en attendant."));
      if (r.status === "no-key") setLangNote(t("Traduction automatique non configurée : un administrateur doit ajouter une clé Google Traduction dans les paramètres."));
      if (r.status === "error") setLangNote(t("La traduction a échoué. Réessayez plus tard."));
      router.refresh();
    } finally {
      setLangBusy(null);
    }
  }
  const go = useCallback((n: number) => {
    setDir(n > step || (step === 3 && n === 0) ? 1 : -1);
    setStep((n + 4) % 4);
  }, [step]);

  useEffect(() => {
    const t = setTimeout(() => go(step + 1), DURATION);
    return () => clearTimeout(t);
  }, [step, go]);

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-nuit px-7 pb-10 pt-14 text-coton">
      <Vignette glow="rgba(200,161,90,0.16)" />
      <Dust />
      <Grain />

      <header className="relative flex items-center justify-between">
        <span className="font-serif text-sm tracking-[5px] text-or">NOS RACINES</span>
        <button onClick={() => go(3)} className="min-h-11 px-1 text-sm text-or-pale">
          {t("Passer")}
        </button>
      </header>

      <motion.div
        className="relative flex flex-1 cursor-grab touch-pan-y flex-col active:cursor-grabbing"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.25}
        onDragEnd={(_, info) => {
          if (info.offset.x < -50) go(step + 1);
          else if (info.offset.x > 50) go(step - 1);
        }}
      >
        <AnimatePresence mode="wait" custom={dir}>
          <motion.section
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 60, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: dir * -60, filter: "blur(6px)" }}
            transition={{ duration: 0.7, ease }}
            className="flex flex-1 flex-col"
          >
            <div className="flex min-h-[360px] flex-1 items-center justify-center">
              {step === 0 && <Baobab />}
              {step === 1 && <Generations />}
              {step === 2 && <QrTree />}
              {step === 3 && <Grandmother />}
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.9, ease }}
              className="mb-3 font-serif text-[34px] font-light leading-[1.15]"
            >
              {t(SLIDES[step].title)}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.9, ease }}
              className="text-[15px] leading-relaxed text-or-pale"
            >
              {t(SLIDES[step].text)}
            </motion.p>
          </motion.section>
        </AnimatePresence>
      </motion.div>

      {step === 0 && (
        <div className="relative mt-6" role="group" aria-label={t("Choisir la langue")}>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => chooseLang(l.code)}
                aria-pressed={lang === l.code}
                className={`min-h-11 rounded-full border px-4 text-sm ${lang === l.code ? "border-or bg-or font-semibold text-nuit" : "border-or-pale/40 text-coton"}`}
              >
                {langBusy === l.code ? "…" : l.native}
              </button>
            ))}
          </div>
          {langNote && <p className="mt-3 text-xs leading-relaxed text-or-pale">{langNote}</p>}
        </div>
      )}

      <footer className="relative mt-7 flex items-center justify-between">
        <div className="flex items-center gap-2" aria-label={t("Écran {n} sur 4", { n: step + 1 })}>
          {SLIDES.map((_, i) =>
            i === step ? (
              <span key={i} className="h-1.5 w-9 overflow-hidden rounded-full bg-or-pale/30">
                <motion.span
                  key={`p${step}`}
                  className="block h-full origin-left rounded-full bg-or"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: DURATION / 1000, ease: "linear" }}
                />
              </span>
            ) : (
              <button key={i} onClick={() => go(i)} aria-label={t("Aller à l’écran {n}", { n: i + 1 })} className="p-1.5">
                <span className="block h-1.5 w-1.5 rounded-full bg-or-pale/35" />
              </button>
            ),
          )}
        </div>
        {step === 3 ? (
          <Link href="/accueil" className="flex min-h-[52px] items-center rounded-full bg-or px-7 font-semibold text-nuit shadow-or">
            {t("Commencer")}
          </Link>
        ) : (
          <button onClick={() => go(step + 1)} className="min-h-[52px] rounded-full bg-or px-7 font-semibold text-nuit shadow-or">
            {t("Suivant")}
          </button>
        )}
      </footer>
    </main>
  );
}

/* ——— Illustrations ——— */

const grow = (delay: number) => ({
  initial: { pathLength: 0 },
  animate: { pathLength: 1 },
  transition: { delay, duration: 2.2, ease: [0.4, 0, 0.2, 1] as const },
});

const TIPS = [
  [18, 108, 11], [62, 96, 9], [34, 140, 7], [88, 36, 12], [122, 46, 9], [100, 72, 7], [148, 12, 10], [188, 12, 10],
  [168, 36, 8], [212, 46, 9], [246, 36, 12], [232, 72, 7], [272, 96, 9], [316, 108, 11], [300, 140, 7], [72, 176, 6],
  [262, 176, 6], [124, 130, 6], [210, 130, 6],
];

function Baobab() {
  return (
    <svg width="334" height="360" viewBox="0 0 334 380" aria-hidden>
      <motion.circle cx="167" cy="120" r="110" fill="rgba(200,161,90,0.10)" animate={{ scale: [1, 1.12, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 4, repeat: Infinity }} style={{ transformOrigin: "167px 120px" }} />
      <g fill="none" stroke="#C8A15A" strokeLinecap="round">
        <motion.path {...grow(0)} d="M150 380 C152 320 148 290 140 250 M184 380 C182 320 186 290 194 250" strokeWidth="3" />
        <motion.path {...grow(0.5)} d="M140 250 C120 210 80 190 46 160 M140 250 C130 200 110 150 96 100 M150 240 C152 190 150 130 160 60 M194 250 C214 210 254 190 288 160 M194 250 C204 200 224 150 238 100 M184 240 C186 190 186 140 176 60" strokeWidth="2" />
        <motion.path {...grow(1.1)} d="M46 160 C30 150 20 130 18 112 M46 160 C60 140 64 120 62 100 M96 100 C84 80 82 60 88 40 M96 100 C112 84 120 70 122 50 M160 60 C150 40 146 28 148 12 M176 60 C186 40 190 28 188 12 M238 100 C226 84 214 70 212 50 M238 100 C250 80 252 60 246 40 M288 160 C304 150 314 130 316 112 M288 160 C274 140 270 120 272 100" strokeWidth="1.25" opacity="0.8" />
      </g>
      {TIPS.map(([x, y, r], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r={r}
          fill="#1F3D2B"
          stroke="#C8A15A"
          strokeWidth="1.5"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.4 + i * 0.05, type: "spring", stiffness: 260, damping: 14 }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      ))}
    </svg>
  );
}

const PHOTOS = [
  { year: "1921", x: 6, y: 10, r: -6, sepia: 1 },
  { year: "1952", x: 150, y: 80, r: 5, sepia: 0.8 },
  { year: "1984", x: 40, y: 190, r: -4, sepia: 0.45 },
  { year: "2026", x: 200, y: 236, r: 7, sepia: 0 },
];

function Generations() {
  return (
    <div className="relative h-[380px] w-[334px]">
      <svg width="334" height="380" className="absolute inset-0" aria-hidden>
        <motion.path {...grow(1.3)} d="M70 70 C140 90 120 150 200 150 S 170 250 110 260 S 230 330 270 320" fill="none" stroke="#C8A15A" strokeWidth="1.25" strokeDasharray="3 5" opacity="0.7" />
      </svg>
      {PHOTOS.map((p, i) => (
        <motion.figure
          key={p.year}
          className="absolute m-0 w-[112px] bg-kapok p-2 pb-7 shadow-polaroid"
          style={{ left: p.x, top: p.y }}
          initial={{ opacity: 0, y: -30, rotate: p.r, scale: 1.05 }}
          animate={i === 0 ? { opacity: [0, 1, 0.5, 1], y: [-30, 0, -6, 0], rotate: p.r, scale: 1 } : { opacity: 1, y: [0, -6, 0], rotate: p.r, scale: 1 }}
          transition={
            i === 0
              ? { delay: i * 0.4, duration: 5, repeat: Infinity, repeatType: "mirror" }
              : { delay: i * 0.4, y: { delay: 1.4, duration: 6, repeat: Infinity, ease: "easeInOut" }, opacity: { delay: i * 0.4, duration: 1 } }
          }
        >
          <svg viewBox="0 0 100 110" className="block w-full" style={{ filter: `sepia(${p.sepia})` }} aria-hidden>
            <rect width="100" height="110" fill="#C4A579" />
            <circle cx="50" cy="44" r="17" fill="#4F3A20" />
            <path d="M12 110c4-30 20-42 38-42s34 12 38 42z" fill="#4F3A20" />
          </svg>
          <figcaption className="mt-0.5 text-center font-main text-lg text-[#4A3A22]">{p.year}</figcaption>
        </motion.figure>
      ))}
    </div>
  );
}

function QrTile({ x, y, delay, gold = false }: { x: number; y: number; delay: number; gold?: boolean }) {
  return (
    <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay, type: "spring", stiffness: 260, damping: 14 }} style={{ transformOrigin: `${x + 17}px ${y + 17}px` }}>
      <rect x={x} y={y} width="34" height="34" rx="6" fill={gold ? "#C8A15A" : "#FAF7F1"} />
      <path d={`M${x + 6} ${y + 6}h9v9h-9zM${x + 19} ${y + 6}h9v9h-9zM${x + 6} ${y + 19}h9v9h-9zM${x + 20} ${y + 20}h3v3h-3zM${x + 25} ${y + 24}h3v4h-3z`} fill="#12261A" />
    </motion.g>
  );
}

function QrTree() {
  return (
    <svg width="334" height="360" viewBox="0 0 334 360" aria-hidden>
      <motion.path {...grow(0)} d="M167 360 V230 M167 230 C140 190 90 170 60 130 M167 230 C190 190 240 170 274 130 M167 230 V90 M60 130 C50 100 52 80 64 60 M274 130 C284 100 282 80 270 60 M167 90 C150 60 140 40 120 24 M167 90 C184 60 194 40 214 24" fill="none" stroke="#C8A15A" strokeWidth="2" strokeLinecap="round" />
      <QrTile x={47} y={44} delay={1.2} />
      <QrTile x={253} y={44} delay={1.5} />
      <QrTile x={103} y={6} delay={1.8} />
      <QrTile x={197} y={6} delay={2.1} />
      <QrTile x={150} y={150} delay={1.4} gold />
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4 }}>
        <path d="M134 136h-8v8M208 136h8v8M134 202h-8v-8M208 202h8v-8" fill="none" stroke="#E6D3A3" strokeWidth="2" />
        <motion.rect x="130" y="146" width="82" height="2" fill="#E6D3A3" animate={{ y: [146, 192, 146] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
      </motion.g>
    </svg>
  );
}

function Grandmother() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-5">
      <motion.figure initial={{ opacity: 0, y: -30, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: -2 }} transition={{ duration: 1.2, ease }} className="m-0 w-[236px] bg-kapok p-2.5 pb-8 shadow-polaroid">
        <div className="h-[220px] overflow-hidden">
          <svg viewBox="0 0 100 102" className="nr-kenburns block h-full w-full [filter:sepia(.9)_contrast(.9)]" aria-hidden>
            <rect width="100" height="102" fill="#B89566" />
            <path d="M30 30c4-14 36-14 40 0 2 6-2 10-6 10H36c-4 0-8-4-6-10z" fill="#7A5A30" />
            <circle cx="50" cy="46" r="15" fill="#5E4526" />
            <path d="M14 102c4-26 18-38 36-38s32 12 36 38z" fill="#5E4526" />
          </svg>
        </div>
        <figcaption className="mt-1.5 text-center font-main text-xl text-[#4A3A22]">{t("Grand-mère, 1968")}</figcaption>
      </motion.figure>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
        <Waveform height={34} barWidth={4} gap={4} />
      </motion.div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} className="font-serif text-[15px] italic text-or-pale">
        {t("« Quand j’étais petite, au village… »")}
      </motion.p>
    </div>
  );
}
