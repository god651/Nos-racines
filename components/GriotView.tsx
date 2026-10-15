"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Grain } from "@/components/ambiance";
import { BottomNav } from "@/components/BottomNav";
import { Portrait } from "@/components/Portrait";
import { api, mediaUrl } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import { sound } from "@/lib/sound";
import { askGriotOnline, griotOnlineAvailable } from "@/lib/griot-ai";

interface Msg {
  id: number;
  me: boolean;
  text: string;
  card?: { id: string; name: string; sub: string; photoId?: string };
  source?: string;
}

function Typewriter({ text, onDone }: { text: string; onDone: () => void }) {
  const [n, setN] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    // Vitesse fixe (~70 caractères/s), calculée sur l'horloge : pas de ralentissement si l'écran saccade.
    const start = performance.now();
    const t = setInterval(() => {
      const k = Math.min(text.length, Math.floor((performance.now() - start) / 14));
      setN(k);
      if (k >= text.length) {
        clearInterval(t);
        done.current();
      }
    }, 30);
    return () => clearInterval(t);
  }, [text]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="ml-0.5 inline-block h-[15px] w-0.5 animate-pulse bg-or-fonce align-[-2px]" />}
    </>
  );
}

export function GriotView({ suggestions, meId }: { suggestions: string[]; meId?: string }) {
  const t = useT();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [typingId, setTypingId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const id = useRef(0);

  useEffect(() => {
    // Accolades obligatoires : les navigateurs récents renvoient une promesse depuis scrollIntoView.
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, thinking]);

  // Deux façons de répondre :
  // - hors ligne, le Griot du téléphone répond aux questions précises (liens, dates, lieux) ;
  // - avec Internet, le Griot en ligne répond à TOUTES les questions, librement, à partir de toute la famille.
  async function ask(q: string) {
    if (!q.trim() || thinking || typingId !== null) return;
    setInput("");
    const history = msgs.map((m) => ({ me: m.me, text: m.text }));
    setMsgs((m) => [...m, { id: ++id.current, me: true, text: q }]);
    setThinking(true);
    type R = { answer?: string; card?: Msg["card"]; source?: string; fallback?: boolean };
    const local = await api<R>("/api/griot", "POST", { question: q }).catch((): R => ({ answer: t("Je n’ai pas pu répondre. Réessayez dans un instant."), fallback: true }));
    let res: R = local;
    if (griotOnlineAvailable()) {
      try {
        const [on] = await Promise.all([askGriotOnline(q, history, meId), new Promise((r) => setTimeout(r, 600))]);
        res = { answer: on.answer, card: local.card, source: t("Le Griot, à partir de toute la famille") };
      } catch (e) {
        const code = (e as Error).message;
        if (code === "limite") res = { answer: t("Vous avez posé beaucoup de questions libres aujourd’hui. Revenez demain ; en attendant, je réponds aux questions précises sur l’arbre."), source: t("Le Griot de la famille") };
        else if (local.fallback) res = { ...local, answer: code === "non_configure" ? t("Les questions libres ne sont pas encore ouvertes pour cette famille. Je réponds aux questions précises sur l’arbre : liens, dates, lieux.") : t("Pour cette question, il faut une connexion Internet : le Griot en ligne lit toute la famille pour vous répondre. Connectez-vous, puis reposez-la.") };
      }
    } else {
      await new Promise((r) => setTimeout(r, 900));
      if (local.fallback && typeof navigator !== "undefined" && navigator.onLine === false) res = { ...local, answer: t("Pour cette question, il faut une connexion Internet : le Griot en ligne lit toute la famille pour vous répondre. Connectez-vous, puis reposez-la.") };
    }
    setThinking(false);
    const mid = ++id.current;
    setTypingId(mid);
    sound.play("chime");
    setMsgs((m) => [...m, { id: mid, me: false, text: res.answer ?? "…", card: res.card, source: res.source }]);
  }

  return (
    <main className="flex h-dvh flex-col bg-kapok">
      <header className="relative flex items-center gap-3 border-b border-or/25 bg-coton/70 px-4 pb-3.5 pt-[52px] backdrop-blur-xl">
        <Link href="/accueil" aria-label={t("Retour")} className="flex h-11 w-11 items-center justify-center rounded-full border border-or-pale bg-coton">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F3D2B" strokeWidth="1.8" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
        </Link>
        <motion.div animate={{ boxShadow: ["0 0 0 0 rgba(200,161,90,.45)", "0 0 0 10px rgba(200,161,90,0)"] }} transition={{ duration: 2.6, repeat: Infinity }} className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-nuit">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
            <path d="M13 27C13 22 12.5 19 12 16M15 27C15 22 15.5 19 16 16" stroke="#C8A15A" strokeWidth="1.6" fill="none" />
            <path d="M12 16C8 13 5 12 3 9M12 16C11 11 10 8 9 4M14 15V3M16 16C17 11 18 8 19 4M16 16C20 13 23 12 25 9" stroke="#C8A15A" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          </svg>
        </motion.div>
        <div>
          <h1 className="font-serif text-xl text-nuit">{t("Le Griot de la famille")}</h1>
          <p className="text-xs text-[#6B5A30]">{griotOnlineAvailable() ? t("Questions libres avec Internet, questions précises sans") : t("Répond à partir de vos fiches et de vos récits")}</p>
        </div>
        <Link href="/quiz" className="ml-auto rounded-full border border-or px-3 py-1.5 text-[12px] text-or-fonce">{t("Quiz")}</Link>
      </header>

      <div className="nr-no-scrollbar relative flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Grain opacity={0.1} blend="multiply" />
        {msgs.length === 0 && !thinking && (
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 text-center font-main text-[22px] text-or-fonce">
            {t("Demandez-moi qui était qui,")}
            <br />
            {t("d’où vient la famille…")}
          </motion.p>
        )}
        <AnimatePresence initial={false}>
          {msgs.map((m) =>
            m.me ? (
              <motion.div key={m.id} initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }} className="max-w-[78%] self-end rounded-[20px_20px_6px_20px] bg-foret px-4 py-3 text-[15px] leading-snug text-coton shadow-doux">
                {m.text}
              </motion.div>
            ) : (
              <motion.div key={m.id} initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }} className="max-w-[86%] self-start rounded-[20px_20px_20px_6px] border border-or/30 bg-coton px-4 py-3.5 shadow-doux">
                <p className="whitespace-pre-line text-[15px] leading-normal text-[#1F2A22]">
                  {typingId === m.id ? <Typewriter text={m.text} onDone={() => setTypingId(null)} /> : m.text}
                </p>
                {typingId !== m.id && m.card && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-3 rounded-[14px] bg-kapok p-2.5">
                    <Portrait size={48} src={mediaUrl(m.card.photoId)} />
                    <div className="flex-1">
                      <div className="font-serif text-base text-nuit">{m.card.name}</div>
                      <div className="text-xs text-[#5A5A52]">{m.card.sub}</div>
                    </div>
                    <Link href={`/membre/${m.card.id}`} aria-label={t("Voir la fiche de {nom}", { nom: m.card.name })} className="flex h-9 w-9 items-center justify-center rounded-full bg-or">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#12261A" strokeWidth="2" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  </motion.div>
                )}
                {typingId !== m.id && m.source && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2.5 text-[11px] text-or-fonce">
                    {t("Source : {x}", { x: m.source })}
                  </motion.p>
                )}
              </motion.div>
            ),
          )}
        </AnimatePresence>
        {thinking && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-1.5 self-start rounded-[20px_20px_20px_6px] border border-or/30 bg-coton px-[18px] py-3.5" aria-label={t("Le Griot réfléchit")}>
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="h-[7px] w-[7px] rounded-full bg-or" animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </motion.div>
        )}
        <div ref={end} />
      </div>

      <div className="border-t border-or/25 bg-coton/75 pt-2.5 backdrop-blur-xl">
        <div className="nr-no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5">
          {suggestions.map((s, i) => (
            <motion.button key={s} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.12 }} onClick={() => ask(s)} className="min-h-10 shrink-0 whitespace-nowrap rounded-full border border-or-pale bg-coton px-3.5 text-[13px] text-foret hover:-translate-y-0.5">
              {s}
            </motion.button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
          className="flex items-center gap-2.5 px-4 pb-3"
        >
          <label className="flex min-h-[50px] flex-1 items-center rounded-full border border-or-pale bg-white px-[18px]">
            <span className="sr-only">{t("Votre question")}</span>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("Posez une question à la famille…")} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
          </label>
          <button type="submit" aria-label={t("Envoyer la question")} className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-or">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12261A" strokeWidth="2" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </form>
      </div>
      <BottomNav />
    </main>
  );
}
