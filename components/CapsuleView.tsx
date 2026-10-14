"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Dust, Grain, Vignette } from "@/components/ambiance";
import { useLang, useT } from "@/lib/i18n/client";
import { Countdown, formatDate } from "./coffre/parts";

const ease = [0.2, 0.7, 0.2, 1] as const;

export function Chest({ sealed }: { sealed: boolean }) {
  return (
    <svg width="260" height="270" viewBox="0 0 260 270" aria-hidden>
      <defs>
        <clipPath id="ground"><rect width="260" height="226" /></clipPath>
      </defs>
      {!sealed && (
        <motion.path d="M70 112 L20 0 H240 L190 112z" fill="rgba(255,220,150,0.18)" animate={{ opacity: [0.55, 0.9, 0.55] }} transition={{ duration: 2.4, repeat: Infinity }} />
      )}
      {!sealed && (
        <motion.g animate={{ y: [0, -10, 0], rotate: [-4, 3, -4] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "131px 59px" }}>
          <rect x="104" y="40" width="54" height="38" rx="3" fill="#F3ECDD" />
          <path d="M104 42l27 20 27-20" fill="none" stroke="#C8A15A" strokeWidth="1.5" />
          <circle cx="131" cy="66" r="6" fill="#9E3B26" />
        </motion.g>
      )}
      <g clipPath="url(#ground)">
        <motion.g animate={{ y: sealed ? 70 : 0 }} transition={{ delay: sealed ? 1.9 : 0, duration: 1.6, ease: [0.6, 0, 0.4, 1] }}>
          <rect x="62" y="120" width="136" height="96" rx="8" fill="#5E3E22" stroke="#C8A15A" strokeWidth="2.5" />
          <path d="M62 150h136M62 186h136" stroke="#8A6A2E" strokeWidth="1.5" />
          <rect x="94" y="120" width="10" height="96" fill="#C8A15A" opacity="0.85" />
          <rect x="156" y="120" width="10" height="96" fill="#C8A15A" opacity="0.85" />
          <motion.g animate={{ rotate: sealed ? 0 : -38 }} transition={{ duration: 0.9, ease: [0.6, 0, 0.3, 1] }} style={{ transformOrigin: "62px 112px" }}>
            <path d="M62 120 V104 C62 84 198 84 198 104 V120z" fill="#6E4A28" stroke="#C8A15A" strokeWidth="2.5" />
            <rect x="94" y="88" width="10" height="32" fill="#C8A15A" opacity="0.85" />
            <rect x="156" y="88" width="10" height="32" fill="#C8A15A" opacity="0.85" />
          </motion.g>
          {sealed && (
            <motion.g initial={{ opacity: 0, y: -60, scale: 1.6 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.9, duration: 0.7, ease }} style={{ transformOrigin: "130px 122px" }}>
              <circle cx="130" cy="122" r="17" fill="#9E3B26" />
              <circle cx="130" cy="122" r="12" fill="none" stroke="#C86A4E" strokeWidth="1.5" />
            </motion.g>
          )}
        </motion.g>
      </g>
      <path d="M0 226 H260" stroke="#5E4526" strokeWidth="2" />
      <rect y="226" width="260" height="44" fill="#3A2A18" />
      {sealed && (
        <>
          <motion.path d="M70 226 C90 200 170 200 190 226z" fill="#4A3520" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 2.8, duration: 0.9, ease }} style={{ transformOrigin: "130px 226px" }} />
          <motion.path d="M130 206 C130 196 132 188 130 176" fill="none" stroke="#9DB08A" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 3.6, duration: 1 }} />
          <motion.path d="M130 184 C138 176 148 178 150 182 C144 188 136 188 130 184z" fill="#9DB08A" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 4.4, type: "spring" }} style={{ transformOrigin: "130px 184px" }} />
          <motion.path d="M130 190 C122 182 112 184 110 188 C116 194 124 194 130 190z" fill="#7F9A70" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 4.6, type: "spring" }} style={{ transformOrigin: "130px 190px" }} />
        </>
      )}
    </svg>
  );
}

export interface CoffreRow {
  id: string;
  title?: string;
  byName: string;
  toLabel: string;
  openDate: string;
  due: boolean;
  items?: number;
  code?: string;
}

export function CapsuleView({ mine, forMe, upcoming }: { mine: CoffreRow[]; forMe: CoffreRow[]; upcoming: CoffreRow[] }) {
  const t = useT();
  const lang = useLang();
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-nuit px-[22px] pb-12 pt-[52px] text-coton">
      <Vignette glow="rgba(200,161,90,0.22)" at="50% 26%" />
      <Dust />
      <Grain opacity={0.09} />
      <header className="relative flex items-center gap-2.5">
        <Link href="/moi" aria-label={t("Retour")} className="flex h-11 w-11 items-center justify-center rounded-full border border-or-pale/20 bg-coton/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E6D3A3" strokeWidth="1.8" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
        </Link>
        <div>
          <p className="font-main text-lg leading-none text-or">{t("pour ceux qui viendront")}</p>
          <h1 className="font-serif text-[26px] font-light">{t("Coffres du futur")}</h1>
        </div>
      </header>

      <motion.div className="relative mt-1 flex h-[250px] items-center justify-center" animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
        <Chest sealed={false} />
      </motion.div>
      <p className="relative mx-auto max-w-[330px] text-center text-[14px] leading-relaxed text-coton/80">
        {t("Laissez une lettre, des photos, un document, votre voix ou une courte vidéo. Choisissez pour qui et le jour où le coffre s’ouvrira. Il se ferme avec votre clé.")}
      </p>
      <Link href="/capsule/nouveau" className="relative mx-auto mt-5 flex min-h-14 w-full max-w-[360px] items-center justify-center rounded-full bg-or font-semibold text-nuit shadow-or">
        {t("Laisser un coffre")}
      </Link>

      {forMe.length > 0 && (
        <Section title={t("Coffres ouverts pour vous")}>
          {forMe.map((c) => (
            <Row key={c.id} c={c} sub={t("De {nom} · ouvert le {date}", { nom: c.byName, date: formatDate(c.openDate, lang) })} glow />
          ))}
        </Section>
      )}
      {mine.length > 0 && (
        <Section title={t("Mes coffres")}>
          {mine.map((c) => (
            <Row key={c.id} c={c} sub={t("Pour {qui} · {date}", { qui: c.toLabel, date: formatDate(c.openDate, lang) })} countdown={!c.due} />
          ))}
        </Section>
      )}
      {upcoming.length > 0 && (
        <Section title={t("Ils vous attendent")}>
          {upcoming.map((c) => (
            <Row key={c.id} c={c} sub={t("De {nom} · s’ouvrira le {date}", { nom: c.byName, date: formatDate(c.openDate, lang) })} countdown />
          ))}
        </Section>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="relative mt-8">
      <h2 className="mb-2.5 font-serif text-lg">{title}</h2>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function Row({ c, sub, countdown, glow }: { c: CoffreRow; sub: string; countdown?: boolean; glow?: boolean }) {
  const t = useT();
  return (
    <Link href={`/capsule/${c.id}`} className={`block rounded-[18px] border px-4 py-3 ${glow ? "border-or bg-or/10 shadow-[0_0_24px_rgba(200,161,90,0.25)]" : "border-or-pale/20 bg-coton/5"}`}>
      <p className="font-serif text-[17px]">{c.title || t("Coffre du futur")}</p>
      <p className="text-[12px] text-or-pale">{sub}</p>
      {countdown && (
        <div className="mt-2">
          <Countdown date={c.openDate} small />
        </div>
      )}
    </Link>
  );
}
