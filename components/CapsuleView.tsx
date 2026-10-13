"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Dust, Grain, Vignette } from "@/components/ambiance";
import { api } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/core";
import { sound } from "@/lib/sound";
import type { Capsule } from "@/lib/types";
import { ErrorNote } from "./ui";

const WHO = [tx("Mes enfants"), tx("Mes petits-enfants"), tx("Mes arrière-petits-enfants"), tx("Toute la famille")];
const YEARS = [2035, 2050, 2075, 2100];
const ease = [0.2, 0.7, 0.2, 1] as const;

function useCountdown(year: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, new Date(year, 0, 1).getTime() - now);
  const days = Math.floor(ms / 86400000);
  const y = Math.floor(days / 365.25);
  return { y, d: Math.floor(days - y * 365.25), h: String(Math.floor((ms % 86400000) / 3600000)).padStart(2, "0"), m: String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0") };
}

function Chest({ sealed }: { sealed: boolean }) {
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

export function CapsuleView({ mine, opened }: { mine: Capsule[]; opened: Capsule[] }) {
  const t = useT();
  const router = useRouter();
  const [who, setWho] = useState(1);
  const [yr, setYr] = useState(1);
  const [text, setText] = useState("");
  const [sealed, setSealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cd = useCountdown(YEARS[yr]);

  async function seal() {
    if (!text.trim()) {
      setError(t("Écrivez d’abord votre lettre."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/capsules", "POST", { recipients: t(WHO[who]), openYear: YEARS[yr], kind: "letter", text });
      setSealed(true);
      sound.play("seal");
      setTimeout(() => sound.play("earth"), 1900);
      setTimeout(() => sound.play("success"), 4300);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-nuit px-[22px] pb-7 pt-[52px] text-coton">
      <Vignette glow="rgba(200,161,90,0.22)" at="50% 32%" />
      <Dust />
      <Grain opacity={0.09} />

      <header className="relative flex items-center gap-2.5">
        <Link href="/moi" aria-label={t("Retour")} className="flex h-11 w-11 items-center justify-center rounded-full border border-or-pale/20 bg-coton/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E6D3A3" strokeWidth="1.8" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
        </Link>
        <div>
          <p className="font-main text-lg leading-none text-or">{t("pour ceux qui viendront")}</p>
          <h1 className="font-serif text-[26px] font-light">{t("Capsule temporelle")}</h1>
        </div>
      </header>

      <motion.div className="relative mt-1 flex h-[270px] items-center justify-center" animate={sealed ? {} : { y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
        <Chest sealed={sealed} />
      </motion.div>

      <AnimatePresence mode="wait">
        {!sealed ? (
          <motion.div key="form" exit={{ opacity: 0, y: 20 }} className="relative flex flex-col gap-4">
            <fieldset>
              <legend className="mb-2 text-xs uppercase tracking-[1.5px] text-or">{t("Pour qui")}</legend>
              <div className="flex flex-wrap gap-1.5">
                {WHO.map((w, i) => (
                  <button key={w} onClick={() => setWho(i)} aria-pressed={who === i} className={`min-h-10 rounded-full border px-3.5 text-[13px] ${who === i ? "border-or bg-or font-semibold text-nuit" : "border-or-pale/35"}`}>{t(w)}</button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-xs uppercase tracking-[1.5px] text-or">{t("À ouvrir en")}</legend>
              <div className="grid grid-cols-4 gap-1.5">
                {YEARS.map((y, i) => (
                  <button key={y} onClick={() => setYr(i)} aria-pressed={yr === i} className={`min-h-[54px] rounded-[14px] border font-serif text-xl ${yr === i ? "border-or bg-or/20 shadow-[0_0_18px_rgba(200,161,90,0.25)]" : "border-or-pale/20 bg-coton/5 text-or-pale"}`}>{y}</button>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[1.5px] text-or">{t("Votre lettre")}</span>
              <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} rows={5} placeholder={t("Ce que je veux que vous sachiez…")} className="w-full rounded-[16px] border border-or-pale/25 bg-coton/5 p-3.5 font-main text-[20px] leading-snug text-coton outline-none placeholder:text-or-pale/50 focus:border-or" />
            </label>
            <ErrorNote message={error} />
            <button onClick={seal} disabled={busy} className="mt-1 min-h-14 rounded-full bg-or font-semibold text-nuit shadow-or disabled:opacity-60">
              {busy ? "…" : t("Sceller la capsule pour {annee}", { annee: YEARS[yr] })}
            </button>
          </motion.div>
        ) : (
          <motion.div key="done" className="relative mt-2.5 flex flex-col items-center gap-2.5 text-center">
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.4 }} className="font-main text-2xl text-or">{t("Scellée avec amour")}</motion.p>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.6 }} className="font-serif text-[26px] font-light leading-tight">{t("Elle s’ouvrira le 1er janvier {annee}", { annee: YEARS[yr] })}</motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.9 }} className="mt-2 flex gap-2.5" aria-live="polite">
              {[
                { v: cd.y, l: t("ans") },
                { v: cd.d, l: t("jours") },
                { v: `${cd.h}:${cd.m}`, l: t("heures") },
              ].map((c) => (
                <div key={c.l} className="min-w-[74px] rounded-[14px] border border-or-pale/20 bg-coton/5 px-2 py-3">
                  <div className="font-serif text-[26px] text-or-pale">{c.v}</div>
                  <div className="text-[11px] text-coton/70">{c.l}</div>
                </div>
              ))}
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.2 }} className="mt-1.5 max-w-[300px] text-[13px] leading-normal text-coton/75">
              {t("Personne ne pourra la lire avant cette date, pas même vous.")}
            </motion.p>
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.6 }} onClick={() => { setSealed(false); setText(""); }} className="mt-2.5 min-h-12 rounded-full border border-or-pale/40 px-[22px] text-sm text-or-pale">
              {t("Préparer une autre capsule")}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {(mine.length > 0 || opened.length > 0) && (
        <section className="relative mt-8">
          {mine.length > 0 && (
            <>
              <h2 className="mb-2 font-serif text-lg">{t("Mes capsules scellées")}</h2>
              <ul className="flex flex-col gap-2">
                {mine.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-[14px] border border-or-pale/20 bg-coton/5 px-3.5 py-3 text-sm">
                    <span>{c.recipients}</span>
                    <span className="font-serif text-or">{c.openYear}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {opened.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 font-serif text-lg">{t("Capsules ouvertes")}</h2>
              {opened.map((c) => (
                <article key={c.id} className="mb-3 rounded-[16px] bg-[#F3ECDD] p-4 text-[#3A3020]">
                  <p className="font-main text-[20px] leading-snug whitespace-pre-line">{c.text}</p>
                  <p className="mt-2 text-xs text-[#6B5A30]">{t("De {nom}, scellée pour {annee}", { nom: c.byName, annee: c.openYear })}</p>
                </article>
              ))}
            </>
          )}
        </section>
      )}
    </main>
  );
}
