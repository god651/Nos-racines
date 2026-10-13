"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Grain } from "@/components/ambiance";
import { Portrait } from "@/components/Portrait";
import { Waveform } from "@/components/Waveform";
import { api, mediaUrl, uploadMedia } from "@/lib/client";
import { useLang, useT } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/core";
import { sound } from "@/lib/sound";
import type { Lang } from "@/lib/types";
import type { PersonOption } from "./forms/PersonForm";
import { Area, ErrorNote, Field, PrimaryButton, Select } from "./ui";

// Mode Ancien : un seul grand bouton. L'enregistrement est réel (micro du téléphone),
// puis rangé dans la fiche de la personne qui raconte.

const QUESTIONS = [
  tx("Comment s’appelait le village de votre mère ?"),
  tx("Quel chant chantiez-vous quand vous étiez enfant ?"),
  tx("Racontez-nous le jour de votre mariage."),
  tx("Quel conseil voulez-vous laisser à vos arrière-petits-enfants ?"),
  tx("Quel était votre jeu préféré quand vous étiez petit(e) ?"),
  tx("Qui était la personne la plus sage de votre enfance ?"),
];

interface StoryItem {
  id: string;
  title: string;
  audioId?: string;
  durationSec: number;
  personName: string;
  photoId?: string;
  personId: string;
}

type Phase = "idle" | "rec" | "review" | "write" | "saved";

const AUDIO_TYPES: Record<string, string> = { opus: "audio/ogg", ogg: "audio/ogg", m4a: "audio/mp4", mp4: "audio/mp4", aac: "audio/aac", mp3: "audio/mpeg", wav: "audio/wav", webm: "audio/webm" };

export function AncienView({ isAdmin, options, tellerId, stories }: { isAdmin: boolean; options: PersonOption[]; tellerId?: string; stories: StoryItem[] }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [tab, setTab] = useState<"raconter" | "ecouter">(isAdmin && options.length ? "raconter" : "ecouter");
  const [teller, setTeller] = useState(options.some((o) => o.id === tellerId) ? tellerId! : options[0]?.id ?? "");
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [secs, setSecs] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array(6).fill(0.2));
  const [blob, setBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState("");
  const [storyLang, setStoryLang] = useState<Lang>(lang);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const tellerName = options.find((o) => o.id === teller)?.name ?? "";
  const blobUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    if (phase !== "idle") return;
    const id = setInterval(() => setQi((q) => (q + 1) % QUESTIONS.length), 8000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => () => cleanup(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function cleanup() {
    cancelAnimationFrame(raf.current);
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((x) => x.stop());
    void ctx.current?.close().catch(() => undefined);
    ctx.current = null;
  }

  function speak() {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(t(QUESTIONS[qi]));
    u.lang = lang === "en" ? "en-GB" : "fr-FR";
    u.rate = 0.88;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t("Le micro n’est pas disponible ici. Utilisez « Importer un message vocal » ou « Écrire un récit »."));
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      sound.duck(true);
      sound.play("bell");
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const r = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => setBlob(new Blob(chunks.current, { type: (r.mimeType || "audio/webm").split(";")[0] }));
      r.start(1000);
      rec.current = r;
      const ac = new AudioContext();
      ctx.current = ac;
      const an = ac.createAnalyser();
      an.fftSize = 64;
      ac.createMediaStreamSource(s).connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const loop = () => {
        an.getByteFrequencyData(data);
        setLevels([2, 4, 6, 8, 11, 14].map((b) => Math.min(1, 0.15 + data[b] / 200)));
        raf.current = requestAnimationFrame(loop);
      };
      loop();
      const t0 = Date.now();
      setSecs(0);
      timer.current = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 500);
      setTitle(t(QUESTIONS[qi]));
      setPhase("rec");
    } catch {
      setError(t("Le micro n’est pas accessible. Autorisez-le dans les réglages du téléphone."));
    }
  }

  function stop() {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
    cleanup();
    sound.duck(false);
    sound.play("chime");
    setPhase("review");
  }

  /** Message vocal déjà enregistré (WhatsApp, dictaphone…) : on l'importe tel quel. */
  function importAudio(file?: File) {
    if (!file) return;
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const type = file.type || AUDIO_TYPES[ext] || "";
    if (!type.startsWith("audio/") && !AUDIO_TYPES[ext]) {
      setError(t("Ce fichier n’est pas un enregistrement audio."));
      return;
    }
    const b = file.type ? file : new Blob([file], { type });
    const probe = new Audio(URL.createObjectURL(b));
    probe.onloadedmetadata = () => setSecs(Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0);
    setSecs(0);
    setBlob(b);
    setTitle(t(QUESTIONS[qi]));
    setPhase("review");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function saveText() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/recits", "POST", { personId: teller, title: title || t("Récit"), text, durationSec: 0, language: storyLang });
      sound.play("success");
      setText("");
      setPhase("saved");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!blob) return;
    setBusy(true);
    setError(null);
    try {
      const ext = blob.type.includes("mp4") ? "m4a" : (blob.type.split("/")[1] ?? "webm");
      const { id: audioId } = await uploadMedia(blob, { filename: `recit.${ext}` });
      await api("/api/recits", "POST", { personId: teller, title, audioId, durationSec: secs, language: storyLang, text: text.trim() || undefined });
      setText("");
      sound.play("success");
      setPhase("saved");
      setBlob(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-kapok px-5 pb-8 pt-[52px]">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-x-16 -top-10 h-[520px]"
        style={{ background: "conic-gradient(from 160deg at 50% 0%, rgba(255,214,140,0) 0deg, rgba(255,214,140,0.35) 12deg, rgba(255,214,140,0) 22deg, rgba(255,214,140,0.25) 32deg, rgba(255,214,140,0) 44deg)", transformOrigin: "50% 0" }}
        animate={{ rotate: [-2, 2, -2], opacity: [0.55, 0.8, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <Grain opacity={0.1} blend="multiply" />

      <div className="relative flex items-center gap-3">
        <Link href="/accueil" aria-label={t("Retour")} className="flex h-11 w-11 items-center justify-center rounded-full border border-or-pale bg-coton">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F3D2B" strokeWidth="1.8" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
        </Link>
        <div role="tablist" className="flex flex-1 gap-1 rounded-full bg-coton/70 p-1">
          {(isAdmin ? (["raconter", "ecouter"] as const) : (["ecouter"] as const)).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`relative min-h-10 flex-1 rounded-full text-sm ${tab === k ? "font-semibold text-coton" : "text-foret"}`}>
              {tab === k && <motion.span layoutId="ancien-tab" className="absolute inset-0 rounded-full bg-foret" />}
              <span className="relative">{k === "raconter" ? t("Raconter") : t("Écouter la famille")}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "raconter" && (
        <div className="relative flex flex-1 flex-col items-center">
          <div className="mt-4 w-full">
            <Select label={t("Qui raconte ?")} value={teller} onChange={(e) => setTeller(e.target.value)} disabled={phase === "rec"}>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </Select>
          </div>

          <motion.figure animate={{ rotate: [-2, 2, -2] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "50% 0" }} className="m-0 mt-4 -rotate-2 bg-coton p-[7px] pb-1 shadow-[0_10px_24px_rgba(74,53,32,0.25)]">
            <Portrait size={104} src={mediaUrl(options.find((o) => o.id === teller)?.photoId)} headwrap ring="transparent" className="!rounded-none" />
            <figcaption className="max-w-[104px] truncate text-center font-main text-lg text-[#3A3020]">{tellerName}</figcaption>
          </motion.figure>

          <div className="mt-4 w-full rounded-[22px] bg-coton/85 px-5 py-4 shadow-doux">
            <div className="flex items-center justify-between">
              <span className="font-main text-[19px] text-or-fonce">{t("Question du jour")}</span>
              <button onClick={speak} aria-label={t("Écouter la question")} className="flex h-9 w-9 items-center justify-center rounded-full bg-kapok">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F3D2B" strokeWidth="1.8" aria-hidden><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a4 4 0 010 6" /></svg>
              </button>
            </div>
            <div className="min-h-[58px]">
              <AnimatePresence mode="wait">
                <motion.p key={qi} initial={{ opacity: 0, y: 12, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -12, filter: "blur(4px)" }} transition={{ duration: 0.7 }} className="font-serif text-[21px] font-light leading-snug text-nuit">
                  {t(QUESTIONS[qi])}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {(phase === "idle" || phase === "rec") && (
              <motion.div key="rec" exit={{ opacity: 0 }} className="flex flex-1 flex-col items-center justify-center py-6">
                <div className="relative h-[170px] w-[170px]">
                  <span className={`absolute inset-0 rounded-full ${phase === "rec" ? "nr-ripple-fast bg-terre/25" : "nr-ripple border-2 border-or"}`} />
                  <span className={`absolute inset-0 rounded-full [animation-delay:1.5s] ${phase === "rec" ? "nr-ripple-fast bg-terre/20" : "nr-ripple border-2 border-or"}`} />
                  <motion.button
                    onClick={() => (phase === "rec" ? stop() : start())}
                    disabled={!teller}
                    aria-label={phase === "rec" ? t("Arrêter l’enregistrement") : t("Raconter mon histoire")}
                    animate={{ backgroundColor: phase === "rec" ? "#B5563A" : "#C8A15A", scale: [1, 1.04, 1] }}
                    transition={{ backgroundColor: { duration: 0.5 }, scale: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}
                    className="absolute inset-0 flex items-center justify-center rounded-full shadow-[0_16px_36px_rgba(138,106,46,0.4),inset_0_2px_0_rgba(255,255,255,0.35)]"
                  >
                    {phase === "rec" ? (
                      <Waveform levels={levels} color="#FAF7F1" height={56} barWidth={6} gap={5} />
                    ) : (
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#12261A" strokeWidth="1.6" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
                    )}
                  </motion.button>
                </div>
                <p className="mt-6 text-center font-serif text-[24px] text-nuit">{phase === "rec" ? t("Je vous écoute…") : t("Raconter mon histoire")}</p>
                <p className="mt-1 text-[15px] text-[#6B5A30]" role="status">{phase === "rec" ? t("{temps} · touchez pour terminer", { temps: `${mm}:${ss}` }) : t("Touchez le bouton doré")}</p>
                <ErrorNote message={error} />
                {phase === "idle" && (
                  <div className="mt-5 flex gap-2">
                    <input ref={fileInput} type="file" accept="audio/*,.opus,.m4a,.ogg" hidden onChange={(e) => importAudio(e.target.files?.[0])} />
                    <button onClick={() => fileInput.current?.click()} disabled={!teller} className="rounded-full border border-or-pale bg-coton/80 px-3.5 py-2 text-[13px] text-foret">
                      {t("Importer un message vocal")}
                    </button>
                    <button onClick={() => { setTitle(""); setPhase("write"); }} disabled={!teller} className="rounded-full border border-or-pale bg-coton/80 px-3.5 py-2 text-[13px] text-foret">
                      {t("Écrire un récit")}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
            {phase === "review" && (
              <motion.div key="review" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex w-full flex-col gap-4 rounded-[22px] bg-coton p-4 shadow-doux">
                <p className="font-serif text-xl text-nuit">{t("Réécoutez avant de garder")}</p>
                {blobUrl && <audio controls src={blobUrl} className="w-full" />}
                <Field label={t("Titre du récit")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
                <Select label={t("Langue parlée")} value={storyLang} onChange={(e) => setStoryLang(e.target.value as Lang)}>
                  <option value="fr">{t("Français")}</option>
                  <option value="bci">{t("Baoulé")}</option>
                  <option value="dyu">{t("Dioula")}</option>
                  <option value="en">{t("Anglais")}</option>
                </Select>
                <ErrorNote message={error} />
                <PrimaryButton onClick={save} loading={busy}>{t("Garder dans la fiche de {nom}", { nom: tellerName.split(" ")[0] })}</PrimaryButton>
                <button onClick={() => { setPhase("idle"); setBlob(null); }} className="min-h-11 text-sm text-[#8A3A26]">{t("Recommencer")}</button>
              </motion.div>
            )}
            {phase === "write" && (
              <motion.div key="write" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex w-full flex-col gap-4 rounded-[22px] bg-coton p-4 shadow-doux">
                <p className="font-serif text-xl text-nuit">{t("Écrire ce qu’on raconte de {nom}", { nom: tellerName.split(" ")[0] })}</p>
                <Field label={t("Titre du récit")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder={t("Ex. : Le jour où il a planté le grand fromager")} />
                <Area label={t("Le récit")} value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} rows={8} />
                <ErrorNote message={error} />
                <PrimaryButton onClick={saveText} loading={busy} disabled={!text.trim()}>{t("Garder dans la fiche de {nom}", { nom: tellerName.split(" ")[0] })}</PrimaryButton>
                <button onClick={() => setPhase("idle")} className="min-h-11 text-sm text-[#6B6455]">{t("Annuler")}</button>
              </motion.div>
            )}
            {phase === "saved" && (
              <motion.div key="saved" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 flex flex-col items-center gap-3 text-center">
                <p className="font-main text-3xl text-or-fonce">{t("Merci, c’est gardé")}</p>
                <p className="text-sm text-[#6B5A30]">{t("Le récit est rangé dans la fiche de {nom}.", { nom: tellerName })}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setPhase("idle")} className="min-h-12 rounded-full bg-or px-5 font-semibold text-nuit">{t("Raconter encore")}</button>
                  <Link href={`/membre/${teller}`} className="flex min-h-12 items-center rounded-full border border-foret px-5 text-foret">{t("Voir la fiche")}</Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {tab === "ecouter" && (
        <div className="relative mt-5 flex flex-col gap-3">
          {stories.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-or bg-or/5 px-6 py-10 text-center">
              <p className="font-serif text-xl text-nuit">{t("Aucun récit pour l’instant")}</p>
              <p className="mt-1.5 text-sm text-[#6B6455]">{isAdmin ? t("Choisissez « Raconter » et laissez un ancien parler.") : t("Les administrateurs enregistreront bientôt les voix de la famille.")}</p>
            </div>
          ) : (
            stories.map((st, i) => (
              <motion.div key={st.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-[20px] bg-coton p-3.5 shadow-doux">
                <div className="flex items-center gap-3">
                  <Portrait size={46} src={mediaUrl(st.photoId)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-base text-nuit">{st.title}</p>
                    <Link href={`/membre/${st.personId}`} className="text-xs text-or-fonce">{st.personName} · {Math.max(1, Math.round(st.durationSec / 60))} min</Link>
                  </div>
                </div>
                {st.audioId && <audio controls preload="none" src={mediaUrl(st.audioId)} className="mt-3 w-full" onPlay={() => sound.duck(true)} onPause={() => sound.duck(false)} onEnded={() => sound.duck(false)} />}
              </motion.div>
            ))
          )}
        </div>
      )}
    </main>
  );
}
