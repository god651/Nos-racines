"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, mediaUrl } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import { buildQuiz, type QuizData } from "@/lib/quiz";
import { sound } from "@/lib/sound";
import { Dust, Grain } from "./ambiance";
import { BottomNav } from "./BottomNav";
import { Portrait } from "./Portrait";
import { BackButton, EmptyState } from "./ui";

const ease = [0.2, 0.7, 0.2, 1] as const;

export interface Leader {
  userId: string;
  name: string;
  points: number;
  games: number;
  best: number;
  me: boolean;
}

/** Points : 10 par bonne réponse, +5 par réponse d'affilée en plus, +50 pour un sans-faute. */
const POINTS = 10;
const STREAK = 5;
const PERFECT = 50;

export function QuizView({ data, familyName, leaders }: { data: QuizData; familyName: string; leaders: Leader[] }) {
  const t = useT();
  const router = useRouter();
  const [round, setRound] = useState(0);
  // Les questions sont tirées une fois par partie (pas de changement en cours de jeu).
  const [questions, setQuestions] = useState(() => buildQuiz(data, t, 10));
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [gain, setGain] = useState<{ n: number; k: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const q = questions[i];
  const done = started && i >= questions.length;

  const choose = (id: string) => {
    if (picked) return;
    setPicked(id);
    if (id === q.answer) {
      const g = POINTS + streak * STREAK;
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
      setPoints((p) => p + g);
      setGain({ n: g, k: Date.now() });
      sound.play("success");
    } else {
      setStreak(0);
      sound.play("tap");
    }
  };
  const next = () => {
    setPicked(null);
    setGain(null);
    setI((x) => x + 1);
    if (i + 1 >= questions.length) {
      sound.play("bell");
      // Fin de partie : on enregistre les points (bonus si sans faute).
      const final = points + (score === questions.length ? PERFECT : 0);
      if (score === questions.length) setPoints(final);
      void api("/api/quiz", "POST", { correct: score, total: questions.length, points: final })
        .then(() => setSaved(true))
        .catch(() => undefined);
    }
  };
  const restart = () => {
    setQuestions(buildQuiz(data, t, 10));
    setRound((r) => r + 1);
    setI(0);
    setScore(0);
    setPoints(0);
    setStreak(0);
    setSaved(false);
    setPicked(null);
    setStarted(true);
    router.refresh();
  };

  const verdict = (() => {
    const r = score / Math.max(1, questions.length);
    if (r >= 0.9) return { title: t("Gardien de la mémoire"), text: t("Vous connaissez votre famille sur le bout des doigts.") };
    if (r >= 0.6) return { title: t("Bon connaisseur"), text: t("Encore quelques histoires à écouter, et vous serez incollable.") };
    return { title: t("Apprenti griot"), text: t("Allez écouter les anciens et parcourir les fiches : la prochaine partie sera la bonne.") };
  })();

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-nuit text-coton">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_50%_at_50%_0%,rgba(200,161,90,0.18),transparent_70%)]" />
      <Dust />
      <Grain opacity={0.08} />
      <header className="relative z-10 flex items-center gap-3 px-4 pt-[52px]">
        <BackButton dark href="/accueil" />
        <div className="min-w-0 flex-1">
          <p className="font-main text-lg leading-none text-or">{familyName}</p>
          <h1 className="font-serif text-[24px] font-light">{t("Quiz de la famille")}</h1>
        </div>
        {started && !done && (
          <span className="rounded-full border border-or/40 px-3 py-1 font-serif text-[15px] text-or" style={{ fontVariantNumeric: "tabular-nums" }}>
            {t("{n} pts", { n: points })}
          </span>
        )}
      </header>

      <div className="relative flex flex-1 flex-col px-5 pb-28 pt-5">
        {questions.length === 0 ? (
          <div className="mt-10">
            <EmptyState dark title={t("Pas encore assez de monde")} text={t("Ajoutez au moins trois personnes, avec leurs dates, villages ou plats favoris : le quiz se fabrique tout seul à partir de l’arbre.")} />
          </div>
        ) : !started ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease }} className="mt-6 flex flex-1 flex-col items-center text-center">
            <motion.div animate={{ rotate: [-4, 4, -4] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="relative mt-4 flex h-36 w-36 items-center justify-center rounded-full border border-or/40 bg-coton/5">
              <span className="nr-ripple absolute inset-0 rounded-full border border-or/50" />
              <span className="font-serif text-[64px] font-light text-or">?</span>
            </motion.div>
            <h2 className="mt-8 font-serif text-[28px] font-light leading-tight">{t("Connaissez-vous bien votre famille ?")}</h2>
            <p className="mt-3 max-w-[300px] text-[15px] leading-relaxed text-or-pale">
              {t("{n} questions tirées de votre arbre : parents, villages, métiers, plats favoris, noms de jour…", { n: questions.length })}
            </p>
            <p className="mt-3 text-[12px] text-or-pale/70">{t("10 points par bonne réponse, des bonus pour les séries, 50 points pour un sans-faute.")}</p>
            {leaders.length > 0 && (
              <div className="mt-6 w-full text-left">
                <Leaderboard leaders={leaders} />
              </div>
            )}
            <div className="flex-1" />
            <button onClick={() => { setStarted(true); sound.play("chime"); }} className="mt-8 min-h-[56px] w-full rounded-full bg-or text-[16px] font-semibold text-nuit shadow-or">
              {t("Commencer le quiz")}
            </button>
          </motion.div>
        ) : done ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease }} className="mt-8 flex flex-col items-center text-center">
            <p className="text-[11px] uppercase tracking-[2px] text-or">{t("Votre score")}</p>
            <p className="mt-2 font-serif text-[72px] font-light leading-none text-or" style={{ fontVariantNumeric: "tabular-nums" }}>
              {score}
              <span className="text-[32px] text-or-pale/70"> / {questions.length}</span>
            </p>
            <div className="mt-5 flex gap-1.5">
              {questions.map((_, k) => (
                <motion.span key={k} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + k * 0.06 }} className={`h-2 w-2 rounded-full ${k < score ? "bg-or" : "bg-coton/20"}`} />
              ))}
            </div>
            <motion.p initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8, type: "spring" }} className="mt-5 rounded-full bg-or px-5 py-2 font-serif text-[20px] text-nuit">
              +{points} {t("points")}
              {score === questions.length && <span className="ml-2 text-[13px]">({t("sans-faute +{n}", { n: PERFECT })})</span>}
            </motion.p>
            <h2 className="mt-6 font-serif text-[28px]">{verdict.title}</h2>
            <p className="mt-2 max-w-[300px] text-[15px] leading-relaxed text-or-pale">{verdict.text}</p>
            <div className="mt-7 w-full text-left">
              <Leaderboard leaders={withMine(leaders, saved ? 0 : points)} />
            </div>
            <button onClick={restart} className="mt-9 min-h-[54px] w-full rounded-full bg-or text-[15px] font-semibold text-nuit shadow-or">
              {t("Nouvelle partie")}
            </button>
            <Link href="/arbre" className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full border border-or/50 text-sm text-or-pale">
              {t("Revoir l’arbre")}
            </Link>
          </motion.div>
        ) : (
          <>
            <div className="mb-5 flex gap-1">
              {questions.map((_, k) => (
                <span key={k} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${k < i ? "bg-or" : k === i ? "bg-or/60" : "bg-coton/15"}`} />
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.section key={q.id + round} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.5, ease }}>
                <div className="flex items-center gap-4">
                  {q.personId && <Portrait size={64} src={mediaUrl(q.photoId)} />}
                  <div>
                    <p className="text-[11px] uppercase tracking-[2px] text-or">{t("Question {n} sur {m}", { n: i + 1, m: questions.length })}</p>
                    <h2 className="mt-1 font-serif text-[22px] font-light leading-snug">{q.prompt}</h2>
                  </div>
                </div>
                <div className="mt-6 space-y-2.5">
                  {q.options.map((o, k) => {
                    const isRight = o.id === q.answer;
                    const state = !picked ? "idle" : isRight ? "right" : o.id === picked ? "wrong" : "off";
                    return (
                      <motion.button
                        key={o.id}
                        data-silent
                        onClick={() => choose(o.id)}
                        disabled={!!picked}
                        initial={{ opacity: 0, y: 12 }}
                        animate={state === "wrong" ? { opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] } : { opacity: state === "off" ? 0.45 : 1, y: 0 }}
                        transition={{ delay: picked ? 0 : 0.15 + k * 0.07, duration: 0.45 }}
                        className={`flex min-h-[58px] w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left text-[15px] transition-colors ${
                          state === "right" ? "border-sauge bg-sauge/25 text-coton" : state === "wrong" ? "border-terre bg-terre/25 text-coton" : "border-or/30 bg-coton/[0.06] text-coton"
                        }`}
                      >
                        {o.photoId !== undefined || q.options.some((x) => x.photoId) ? <Portrait size={36} src={mediaUrl(o.photoId)} /> : null}
                        <span className="flex-1">{o.label}</span>
                        {state === "right" && (
                          <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9DB08A" strokeWidth="2.4" aria-hidden><path d="M5 12l5 5 9-10" /></motion.svg>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
                <AnimatePresence>
                  {gain && (
                    <motion.p
                      key={gain.k}
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: [0, 1, 1, 0], y: -40, scale: 1.1 }}
                      transition={{ duration: 1.6, ease }}
                      className="pointer-events-none absolute right-6 top-40 z-20 font-serif text-[28px] text-or"
                    >
                      +{gain.n}
                    </motion.p>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {picked && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mt-5 rounded-[18px] bg-coton/[0.07] p-4">
                      <p className="font-serif text-[18px] text-or">
                        {picked === q.answer ? (streak > 1 ? t("Bravo ! {n} d’affilée", { n: streak }) : t("Bravo !")) : t("Pas tout à fait…")}
                      </p>
                      <p className="mt-1 text-[14px] leading-relaxed text-coton/90">{q.explain}</p>
                      <div className="mt-4 flex gap-2">
                        {q.personId && (
                          <Link href={`/membre/${q.personId}`} className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-or/40 text-[13px] text-or-pale">
                            {t("Voir la fiche")}
                          </Link>
                        )}
                        <button onClick={next} className="min-h-12 flex-1 rounded-full bg-or text-[14px] font-semibold text-nuit">
                          {i + 1 >= questions.length ? t("Voir mon score") : t("Question suivante")}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            </AnimatePresence>
          </>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 z-20">
        <BottomNav />
      </div>
    </main>
  );
}

/** Ajoute (en direct) les points de la partie qui vient de finir avant qu'ils ne reviennent du stockage. */
function withMine(leaders: Leader[], pending: number) {
  if (!pending) return leaders;
  const list = leaders.map((l) => (l.me ? { ...l, points: l.points + pending } : l));
  if (!list.some((l) => l.me)) list.push({ userId: "me", name: "", points: pending, games: 1, best: 0, me: true });
  return list.sort((a, b) => b.points - a.points);
}

function Leaderboard({ leaders }: { leaders: Leader[] }) {
  const t = useT();
  const medal = ["#E6C46B", "#C9CCD1", "#C88B5A"];
  return (
    <div className="rounded-[20px] border border-or/25 bg-coton/[0.05] p-4">
      <p className="mb-2 text-[11px] uppercase tracking-[2px] text-or">{t("Classement de la famille")}</p>
      <ol className="space-y-1.5">
        {leaders.slice(0, 8).map((l, k) => (
          <motion.li key={l.userId} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.06 }} className={`flex items-center gap-3 rounded-[12px] px-2 py-1.5 ${l.me ? "bg-or/15" : ""}`}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full font-serif text-[14px]" style={{ background: medal[k] ?? "rgba(250,247,241,0.08)", color: k < 3 ? "#12261A" : "#E6D3A3" }}>
              {k + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px]">{l.name || t("Vous")}{l.me && l.name ? ` · ${t("vous")}` : ""}</span>
            <span className="font-serif text-[15px] text-or" style={{ fontVariantNumeric: "tabular-nums" }}>{l.points}</span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
