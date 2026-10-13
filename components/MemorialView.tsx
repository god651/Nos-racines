"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, mediaUrl } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import { askConfirm } from "@/components/Confirm";
import { READINGS, readingText } from "@/lib/memorial-texts";
import { sound } from "@/lib/sound";
import type { Lang } from "@/lib/types";
import { Dust, Grain } from "./ambiance";
import { BackButton, ErrorNote } from "./ui";
import { LivingPortrait } from "./LivingPortrait";

export interface MemorialData {
  id: string;
  givenName: string;
  name: string;
  sex: "m" | "f";
  photoId?: string;
  animated: boolean;
  birthYear?: number;
  deathYear?: number;
  deathDate?: string;
  quote?: string;
  candles: number;
  myCandleToday: boolean;
  messages: { id: string; byName: string; text: string; createdAt: number; canDelete: boolean }[];
  anniv: { kind: "birth" | "death"; inDays: number; years: number } | null;
  stories: number;
  lang: Lang;
}

const ease = [0.2, 0.7, 0.2, 1] as const;
const READ_MS = 11000;

// Colombe (dessin 0–20).
const DOVE = "M1 10.5c2.2-.9 4.3-.8 6.2.2.6-2.6 2.5-4.6 5.1-5.3-.9 1.1-1.3 2.2-1.3 3.3 1.5-.3 3.1.1 4.5 1.2.5-.6 1.3-.9 2.2-.8-.5.5-.8 1.1-.9 1.8-.3 2.4-2.3 4.3-5 4.6-2.6.3-5-.7-6.6-2.6-1.3.1-2.8-.3-4.2-1.4z";

export function MemorialView({ d }: { d: MemorialData }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [lit, setLit] = useState(false);

  const locale = d.lang === "en" ? "en-GB" : "fr-FR";
  const deathFull = d.deathDate ? new Date(d.deathDate + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) : undefined;
  const ago = d.deathYear ? new Date().getFullYear() - d.deathYear : undefined;
  const f = d.sex === "f";

  const anniv = (() => {
    if (!d.anniv) return null;
    const { kind, inDays, years } = d.anniv;
    if (kind === "death") {
      if (inDays === 0) return f ? t("Aujourd’hui, cela fait {n} ans qu’elle nous a quittés.", { n: years }) : t("Aujourd’hui, cela fait {n} ans qu’il nous a quittés.", { n: years });
      return t("Dans {j} jour(s), cela fera {n} ans de son départ.", { j: inDays, n: years });
    }
    if (inDays === 0) return f ? t("Elle aurait eu {n} ans aujourd’hui.", { n: years }) : t("Il aurait eu {n} ans aujourd’hui.", { n: years });
    return f ? t("Dans {j} jour(s), elle aurait eu {n} ans.", { j: inDays, n: years }) : t("Dans {j} jour(s), il aurait eu {n} ans.", { j: inDays, n: years });
  })();

  async function light() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/hommages", "POST", { personId: d.id, kind: "candle" });
      sound.play("candle");
      setLit(true);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function leaveWord(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/hommages", "POST", { personId: d.id, kind: "message", text });
      sound.play("chime");
      setText("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!(await askConfirm(t("Retirer ce mot ?")))) return;
    await api(`/api/hommages/${id}`, "DELETE").catch(() => undefined);
    router.refresh();
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#0B1711] pb-16 text-coton">
      {/* Ciel de veillée : lueur des bougies en bas, poussière de lumière. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_45%_at_50%_0%,rgba(200,161,90,0.14),transparent_70%),radial-gradient(70%_40%_at_50%_100%,rgba(255,190,110,0.12),transparent_70%)]" />
      <Dust />
      <Grain opacity={0.08} />

      <header className="relative z-10 flex items-center justify-between px-4 pt-[52px]">
        <BackButton dark />
        <Link href={`/membre/${d.id}`} className="rounded-full border border-or-pale/30 bg-coton/5 px-3.5 py-2 text-[12px] text-or-pale backdrop-blur-md">
          {t("Voir sa fiche complète")}
        </Link>
      </header>

      {/* Yako */}
      <section className="relative mt-4 text-center">
        <motion.h1
          initial={{ opacity: 0, letterSpacing: "0.35em", filter: "blur(8px)" }}
          animate={{ opacity: 1, letterSpacing: "0.06em", filter: "blur(0px)" }}
          transition={{ duration: 2.4, ease }}
          className="nr-yako mx-auto font-serif text-[76px] font-light italic leading-none"
        >
          Yako
        </motion.h1>
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.2, duration: 1.4, ease }} className="mx-auto mt-3 flex w-44 items-center gap-2">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-or/70" />
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden className="shrink-0">
            <path d={DOVE} fill="#E6D3A3" />
          </svg>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-or/70" />
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 1.2 }} className="mt-2 font-main text-[19px] text-or-pale">
          {t("La famille se souvient")}
        </motion.p>
      </section>

      {/* Portrait en arche */}
      <section className="relative mt-6 flex flex-col items-center px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 1.6, ease }} className="relative">
          <motion.div aria-hidden className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(255,210,140,0.28),transparent_65%)]" animate={{ opacity: [0.6, 1, 0.6], scale: [0.97, 1.03, 0.97] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} />
          <div className="relative h-[200px] w-[156px] overflow-hidden rounded-t-full border border-or/60 bg-[#2A2016] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div className="h-full w-full overflow-hidden rounded-t-full">
              {d.photoId && d.animated ? (
                <LivingPortrait src={mediaUrl(d.photoId)!} className="h-full w-full" imgClassName="object-[50%_22%]" />
              ) : d.photoId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(d.photoId)} alt="" className="h-full w-full object-cover [filter:sepia(.55)_contrast(1.02)_brightness(.92)]" />
              ) : (
                <svg viewBox="0 0 156 200" className="h-full w-full" aria-hidden>
                  <rect width="156" height="200" fill="#8C6E48" />
                  {f && <path d="M48 62c4-20 56-20 60 0 2 9-3 14-9 14H57c-6 0-11-5-9-14z" fill="#5E4526" />}
                  <circle cx="78" cy="86" r="26" fill="#4A3520" />
                  <path d="M22 200c6-52 28-82 56-82s50 30 56 82z" fill="#4A3520" />
                </svg>
              )}
            </div>
          </div>
          <motion.svg aria-hidden width="34" height="34" viewBox="0 0 20 20" className="absolute -right-7 top-6" animate={{ y: [0, -6, 0], rotate: [-4, 3, -4] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}>
            <path d={DOVE} fill="#FAF7F1" opacity="0.9" />
          </motion.svg>
        </motion.div>
        <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6, duration: 1 }} className="mt-6 font-serif text-[32px] font-light leading-tight">
          {d.name}
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9 }} className="mt-1 font-serif text-[17px] text-or" style={{ fontVariantNumeric: "tabular-nums" }}>
          {d.birthYear ?? "?"} – {d.deathYear ?? "?"}
        </motion.p>
        {(deathFull || ago) && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.1 }} className="mt-1 text-[13px] text-or-pale/80">
            {deathFull ? (f ? t("Partie le {date}", { date: deathFull }) : t("Parti le {date}", { date: deathFull })) : ""}
            {deathFull && ago ? " · " : ""}
            {ago ? t("il y a {n} ans", { n: ago }) : ""}
          </motion.p>
        )}
        {anniv && (
          <motion.p initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 2.3 }} className="mt-4 rounded-full border border-or/50 bg-or/10 px-4 py-2 text-[13px] text-or-pale">
            {anniv}
          </motion.p>
        )}
        {d.quote && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5, duration: 1.2 }} className="mt-5 max-w-[320px] font-serif text-[17px] italic leading-snug text-coton/85">
            « {d.quote} »
          </motion.p>
        )}
      </section>

      <Readings d={d} />

      {/* Bougies */}
      <section className="relative mx-5 mt-8 rounded-[24px] border border-or/20 bg-coton/[0.04] px-5 pb-5 pt-6 text-center backdrop-blur-sm">
        <Candles count={d.candles} fresh={lit} />
        <p className="mt-4 text-[13px] text-or-pale">
          {d.candles === 0 ? t("Aucune bougie pour l’instant") : t("{n} bougie(s) allumée(s) pour {p}", { n: d.candles, p: d.givenName })}
        </p>
        <button
          onClick={light}
          disabled={busy || d.myCandleToday}
          data-silent
          className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-or text-[15px] font-semibold text-nuit shadow-or disabled:bg-or/40 disabled:text-coton/80 disabled:shadow-none"
        >
          {d.myCandleToday ? t("Votre bougie brûle aujourd’hui") : t("Allumer une bougie")}
        </button>
      </section>

      {/* Mots */}
      <section className="relative mx-5 mt-8">
        <h3 className="font-serif text-[22px]">{t("Mots pour {p}", { p: d.givenName })}</h3>
        <form onSubmit={leaveWord} className="mt-3">
          <label className="block">
            <span className="sr-only">{t("Votre mot")}</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={t("Un souvenir, une prière, un merci…")}
              className="w-full resize-none rounded-[18px] border border-or/30 bg-coton/[0.06] px-4 py-3 font-main text-[20px] leading-snug text-coton outline-none placeholder:text-or-pale/50 focus:border-or"
            />
          </label>
          <ErrorNote message={error} />
          <button type="submit" disabled={busy || !text.trim()} className="mt-2 min-h-11 w-full rounded-full border border-or text-[14px] text-or disabled:opacity-40">
            {t("Déposer ce mot")}
          </button>
        </form>
        <div className="mt-5 space-y-3">
          <AnimatePresence initial={false}>
            {d.messages.map((m, i) => (
              <motion.article
                key={m.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.08, duration: 0.6, ease }}
                className="relative rounded-[18px] bg-[#F3ECDD] px-4 pb-3 pt-4 text-[#2A2016] shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
              >
                <p className={`whitespace-pre-line font-main text-[21px] leading-snug ${m.canDelete ? "pr-6" : ""}`}>{m.text}</p>
                <p className="mt-2 text-[11px] text-[#6B5A30]">
                  {m.byName} · {new Date(m.createdAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}
                </p>
                {m.canDelete && (
                  <button onClick={() => void remove(m.id)} aria-label={t("Retirer")} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-[#9A8A6A]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                )}
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {d.stories > 0 && (
        <Link href={`/membre/${d.id}`} className="relative mx-5 mt-8 flex items-center justify-between rounded-[18px] border border-or/25 px-4 py-3 text-[13px] text-or-pale">
          {t("{n} récit(s) sur sa vie", { n: d.stories })}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C8A15A" strokeWidth="2" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
        </Link>
      )}
    </main>
  );
}

/** Prières et passages de la Bible qui se succèdent doucement. */
function Readings({ d }: { d: MemorialData }) {
  const t = useT();
  const start = useMemo(() => Math.floor(Date.now() / 86400000) % READINGS.length, []);
  const [i, setI] = useState(start);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setI((x) => (x + 1) % READINGS.length), READ_MS);
    return () => clearInterval(id);
  }, [paused]);
  const r = READINGS[i];
  const { text, ref } = readingText(r, d.lang, d.givenName, d.sex);
  return (
    <section className="relative mx-5 mt-9">
      <button
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? t("Reprendre") : t("Pause")}
        className="relative block w-full overflow-hidden rounded-[24px] border border-or/25 bg-[linear-gradient(160deg,rgba(243,236,221,0.08),rgba(243,236,221,0.02))] px-5 pb-6 pt-5 text-left"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[2px] text-or">{r.kind === "bible" ? t("Parole") : t("Prière")}</span>
          <span className="text-[10px] text-or-pale/60">{paused ? t("En pause") : `${i + 1} / ${READINGS.length}`}</span>
        </div>
        <div className="relative mt-3 min-h-[150px]">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 1.1, ease }}>
              <p className="font-serif text-[18px] font-light leading-relaxed text-coton/95">{text}</p>
              {ref && <p className="mt-3 text-[12px] italic text-or">{ref}</p>}
            </motion.div>
          </AnimatePresence>
        </div>
        {!paused && <motion.span key={`bar-${i}`} className="absolute bottom-0 left-0 h-[2px] bg-or/60" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: READ_MS / 1000, ease: "linear" }} />}
      </button>
      <p className="mt-2 text-center text-[11px] text-or-pale/50">{t("Touchez pour mettre en pause")}</p>
    </section>
  );
}

/** Rangée de bougies ; la dernière allumée prend feu sous vos yeux. */
function Candles({ count, fresh }: { count: number; fresh: boolean }) {
  const shown = Math.min(count, 9);
  return (
    <div className="flex min-h-[86px] items-end justify-center gap-2.5" aria-hidden>
      {shown === 0 && (
        <svg width="26" height="70" viewBox="0 0 26 70">
          <rect x="7" y="26" width="12" height="44" rx="2" fill="#E9DFC8" opacity="0.35" />
          <path d="M13 26v-5" stroke="#3A2A1A" strokeWidth="1.4" />
        </svg>
      )}
      {Array.from({ length: shown }).map((_, k) => {
        const h = 40 + ((k * 7) % 3) * 6;
        const isNew = fresh && k === shown - 1;
        return (
          <motion.svg key={k} width="26" height="86" viewBox="0 0 26 86" initial={isNew ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <defs>
              <radialGradient id={`glow-${k}`}>
                <stop offset="0%" stopColor="rgba(255,214,140,0.65)" />
                <stop offset="100%" stopColor="rgba(255,214,140,0)" />
              </radialGradient>
            </defs>
            <circle cx="13" cy={86 - h - 12} r="13" fill={`url(#glow-${k})`} className="nr-breathe" />
            <rect x="7" y={86 - h} width="12" height={h} rx="2" fill="#F3ECDD" />
            <rect x="7" y={86 - h} width="12" height="5" rx="2" fill="#E2D5B8" />
            <path d={`M13 ${86 - h}v-4`} stroke="#3A2A1A" strokeWidth="1.2" />
            <motion.path
              className="nr-flame"
              d={`M13 ${86 - h - 20}c3.6 4.2 4.6 7.6 2.6 10.4-1.3 1.7-3.9 1.7-5.2 0-2-2.8-1-6.2 2.6-10.4z`}
              fill="#FFC861"
              initial={isNew ? { scale: 0 } : false}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 10 }}
              style={{ animationDelay: `${k * 0.23}s` }}
            />
            <path className="nr-flame" d={`M13 ${86 - h - 14}c1.4 1.8 1.8 3.2 1 4.3-.5.7-1.5.7-2 0-.8-1.1-.4-2.5 1-4.3z`} fill="#FFF3D1" style={{ animationDelay: `${k * 0.23}s` }} />
          </motion.svg>
        );
      })}
      {count > 9 && <span className="mb-2 font-serif text-lg text-or">+{count - 9}</span>}
    </div>
  );
}
