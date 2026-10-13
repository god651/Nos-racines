"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { mediaUrl } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import type { TimelineEvent } from "@/lib/types";
import { Dust, Grain, Vignette } from "./ambiance";

export interface PublicData {
  familyName: string;
  name: string;
  years: string;
  village?: string;
  quote?: string;
  bio?: string;
  photoId?: string;
  isPublic: boolean;
  events: TimelineEvent[];
  isMember: boolean;
  personId: string;
}

const ease = [0.2, 0.7, 0.2, 1] as const;
const up = (delay: number) => ({
  initial: { opacity: 0, y: 16, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { delay, duration: 1.1, ease },
});

export function PublicProfile({ d: p }: { d: PublicData }) {
  const t = useT();
  // Le portrait s'incline en 3D selon le doigt ou la souris.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), { stiffness: 80, damping: 15 });
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [9, -9]), { stiffness: 80, damping: 15 });
  const events = p.events.length > 4 ? [p.events[0], p.events[1], p.events[p.events.length - 2], p.events[p.events.length - 1]] : p.events;

  return (
    <main
      className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-nuit px-6 pb-7 pt-12 text-center text-coton"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <Vignette glow="rgba(200,161,90,0.2)" at="50% 22%" />
      <Dust />

      <motion.p {...up(1.4)} className="relative font-serif text-xs tracking-[5px] text-or">
        {t("FAMILLE {nom}", { nom: p.familyName.toUpperCase() })}
      </motion.p>

      <motion.div style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 600 }} className="relative mt-6 flex h-[196px] w-[196px] items-center justify-center">
        <motion.svg animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }} viewBox="0 0 196 196" className="absolute inset-0" aria-hidden>
          <circle cx="98" cy="98" r="94" fill="none" stroke="#C8A15A" strokeWidth="1" strokeDasharray="2 6" opacity="0.7" />
        </motion.svg>
        <div className="h-[168px] w-[168px] overflow-hidden rounded-full border-[3px] border-or shadow-[0_0_40px_rgba(200,161,90,0.25)]">
          {p.photoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <motion.img
              src={mediaUrl(p.photoId)}
              alt=""
              className="block h-full w-full object-cover"
              initial={{ filter: "sepia(1) brightness(2) contrast(.3) blur(8px)", scale: 1.25 }}
              animate={{ filter: "sepia(.4) brightness(.95) contrast(1) blur(0px)", scale: 1 }}
              transition={{ delay: 0.6, duration: 2.6, ease }}
            />
          ) : (
            <motion.svg
              viewBox="0 0 168 168"
              className="block h-full w-full"
              initial={{ filter: "sepia(1) brightness(2) contrast(.3) blur(8px)", scale: 1.25 }}
              animate={{ filter: "sepia(.9) brightness(.9) contrast(.95) blur(0px)", scale: 1 }}
              transition={{ delay: 0.6, duration: 2.6, ease }}
              aria-hidden
            >
              <rect width="168" height="168" fill="#B89566" />
              <circle cx="84" cy="70" r="26" fill="#4A3520" />
              <path d="M24 168c6-44 30-66 60-66s54 22 60 66z" fill="#4A3520" />
            </motion.svg>
          )}
        </div>
      </motion.div>

      <motion.h1 {...up(1.8)} className="relative mt-5 font-serif text-[34px] font-light">{p.name}</motion.h1>
      <motion.p {...up(2)} className="relative font-main text-[21px] text-or-pale">
        {[p.years, p.village].filter(Boolean).join(" · ")}
      </motion.p>
      {p.quote && (
        <motion.p {...up(2.2)} className="relative mx-2 mt-3.5 font-serif text-[17px] italic leading-snug text-or-pale">
          « {p.quote} »
        </motion.p>
      )}

      {p.bio && (
        <motion.p {...up(2.4)} className="relative mt-4 line-clamp-6 text-left text-sm leading-relaxed text-coton/85">
          {p.bio}
        </motion.p>
      )}
      {!p.isPublic && (
        <motion.p {...up(2.2)} className="relative mt-5 rounded-[16px] border border-or/30 px-4 py-3 text-sm leading-relaxed text-or-pale">
          {t("Cette fiche est réservée à la famille. Demandez une invitation à un administrateur pour la découvrir.")}
        </motion.p>
      )}

      {events.length > 0 && (
        <ol className="relative mt-6 w-full text-left">
          {/* Fil doré qui se trace, puis chaque date s'allume. */}
          <motion.span aria-hidden className="absolute bottom-3 left-[5px] top-2 w-px origin-top bg-or" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 2.6, duration: 1.8, ease }} />
          {events.map((ev, i) => (
            <motion.li key={ev.year + ev.text} {...up(2.7 + i * 0.5)} className="relative flex gap-3 pb-3 pl-6">
              <motion.span aria-hidden className="absolute left-0 top-[5px] h-[11px] w-[11px] rounded-full bg-or shadow-[0_0_0_3px_#12261A]" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 2.7 + i * 0.5, type: "spring" }} />
              <span className="w-10 shrink-0 font-serif text-[15px] text-or">{ev.year}</span>
              <span className="text-sm leading-snug">{ev.text}</span>
            </motion.li>
          ))}
        </ol>
      )}

      <div className="flex-1" />
      <motion.div {...up(4)} className="relative w-full">
        <Link href={p.isMember ? `/membre/${p.personId}` : "/bienvenue"} className="flex min-h-[52px] w-full items-center justify-center rounded-full bg-or font-semibold text-nuit shadow-or">
          {p.isMember ? t("Ouvrir sa fiche complète") : t("Je fais partie de la famille")}
        </Link>
      </motion.div>
      <motion.p {...up(4.2)} className="relative mt-3 text-[11px] text-or-pale/70">{t("Mémoire préservée avec NOS RACINES")}</motion.p>

      <Grain opacity={0.08} />
      {/* Ouverture cinématographique depuis le noir. */}
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 bg-[#050B07]" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.2, duration: 1.6 }} />
    </main>
  );
}
