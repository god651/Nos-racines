"use client";

import { SHAPES } from "@/lib/ci-map-data";
import { ScanButton } from "./Scanner";
import { animate, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import { sound } from "@/lib/sound";
import { Dust, Grain } from "./ambiance";
import { BottomNav } from "./BottomNav";
import { AncestorFace, DEFAULT_FACE } from "./AncestorFace";
import { CoverSlideshow } from "./CoverSlideshow";
import { Polaroid, Portrait } from "./Portrait";
import { Waveform } from "./Waveform";

const ease = [0.2, 0.7, 0.2, 1] as const;
const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { delay, duration: 1, ease },
});

export interface HomeData {
  family: { name: string; village: string; motto: string };
  covers: string[];
  stats: { members: number; generations: number; memories: number; voiceValue: number; voiceUnit: string };
  userName: string;
  isAdmin: boolean;
  invited: boolean;
  featured: { title: string; personName: string; personId: string; audioId?: string; photoId?: string; minutes: number } | null;
  memories: { id: string; caption: string; year?: number; photoId?: string }[];
  face?: string;
  annivs: { personId: string; givenName: string; photoId?: string; sex: "m" | "f"; isLiving: boolean; kind: "birth" | "death"; inDays: number; years: number }[];
}

function CountUp({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration: to ? 1.8 : 0.01, delay: 0.7, ease: [0.2, 0.7, 0.2, 1], onUpdate: (x) => setV(x) });
    return () => c.stop();
  }, [to]);
  return <>{decimals ? v.toFixed(decimals).replace(".", ",") : Math.round(v)}</>;
}

export function HomeView({ d }: { d: HomeData }) {
  const t = useT();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  const tx = useTransform(sx, (v) => v * -18);
  const ty = useTransform(sy, (v) => v * -12);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function togglePlay() {
    if (!d.featured?.audioId) return;
    if (!audio.current) {
      audio.current = new Audio(mediaUrl(d.featured.audioId));
      audio.current.onended = () => {
        setPlaying(false);
        sound.duck(false);
      };
    }
    if (playing) {
      audio.current.pause();
      sound.duck(false);
      setPlaying(false);
    } else {
      sound.duck(true);
      void audio.current.play();
      setPlaying(true);
    }
  }
  useEffect(() => () => audio.current?.pause(), []);

  // Premiers pas : guide l'administrateur tant que la famille est encore peu remplie.
  const steps = [
    { done: d.stats.members > 0, label: t("Ajouter une première personne"), href: "/personne/nouvelle" },
    { done: d.stats.voiceValue > 0, label: t("Enregistrer une première voix"), href: "/ancien" },
    { done: d.stats.memories > 0, label: t("Ajouter un souvenir en photo"), href: "/souvenir/nouveau" },
    { done: d.covers.length > 0, label: t("Choisir les photos de couverture"), href: "/parametres#couverture" },
    { done: d.invited, label: t("Inviter la famille"), href: "/qr" },
  ];
  const showSteps = d.isAdmin && steps.some((s) => !s.done);

  return (
    <main className="flex min-h-dvh flex-col bg-coton">
      <section
        className="relative flex h-[300px] flex-col justify-end overflow-hidden bg-nuit px-6 pb-11"
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
        {d.covers.length ? (
          <CoverSlideshow ids={d.covers} px={tx} py={ty} />
        ) : (
          <motion.svg style={{ x: tx, y: ty }} viewBox="0 0 390 280" className="nr-kenburns absolute inset-0 h-full w-full [filter:sepia(.85)_contrast(.9)_brightness(.55)]" preserveAspectRatio="xMidYMid slice" aria-hidden>
            <rect width="390" height="280" fill="#B89566" />
            <rect y="190" width="390" height="90" fill="#8C6D44" />
            <g fill="#4A3520">
              <circle cx="70" cy="120" r="20" /><path d="M36 200c4-36 18-54 34-54s30 18 34 54z" />
              <circle cx="140" cy="108" r="22" /><path d="M104 200c4-40 20-60 36-60s32 20 36 60z" />
              <circle cx="215" cy="114" r="21" /><path d="M180 200c4-38 19-56 35-56s31 18 35 56z" />
              <circle cx="288" cy="104" r="23" /><path d="M252 200c4-42 20-62 36-62s32 20 36 62z" />
              <circle cx="345" cy="140" r="14" /><path d="M322 200c3-26 13-38 23-38s20 12 23 38z" />
            </g>
          </motion.svg>
        )}
        {/* Teinte et lumière chaudes : les photos se fondent dans le décor. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_85%_10%,rgba(230,170,90,0.4),transparent_60%),linear-gradient(180deg,rgba(18,38,26,0.35)_0%,transparent_30%,rgba(18,38,26,0.94)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[#C8A15A] opacity-[0.12] mix-blend-soft-light" />
        {/* Le visage de l'ancêtre honoré, fondu dans la lumière du ciel. */}
        <AncestorFace src={mediaUrl(d.face) ?? DEFAULT_FACE} size={210} opacity={0.2} delay={1.5} className="-right-6 top-6" />
        <Grain opacity={0.14} />
        <Dust />
        <ScanButton className="absolute right-16 top-[52px] z-10 flex h-10 w-10 items-center justify-center rounded-full border border-or-pale/25 bg-nuit/40 text-[#E6D3A3] backdrop-blur-md" />
        <Link href="/parametres" aria-label={t("Paramètres")} className="absolute right-4 top-[52px] z-10 flex h-10 w-10 items-center justify-center rounded-full border border-or-pale/25 bg-nuit/40 backdrop-blur-md">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#E6D3A3" strokeWidth="1.7" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
          </svg>
        </Link>
        <motion.p {...fadeUp(0.3)} className="relative font-main text-xl text-or-pale">
          {d.family.name}{d.family.village ? ` · ${d.family.village}` : ""}
        </motion.p>
        <motion.h1 {...fadeUp(0.5)} className="relative font-serif text-[34px] font-light text-coton">
          {t("Akwaba, {nom}", { nom: d.userName })}
        </motion.h1>
        {d.family.motto && (
          <motion.p {...fadeUp(0.7)} className="relative mt-0.5 font-serif text-[13px] italic text-or-pale/90">« {d.family.motto} »</motion.p>
        )}
      </section>

      <motion.div {...fadeUp(0.7)} className="relative z-10 mx-4 -mt-7 grid grid-cols-4 overflow-hidden rounded-[22px] border border-or/35 bg-coton/85 py-4 shadow-doux backdrop-blur-xl">
        <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-[rgba(255,236,190,0.55)] to-transparent" initial={{ x: "-120%" }} animate={{ x: "520%" }} transition={{ delay: 2.5, duration: 1.6, repeat: Infinity, repeatDelay: 4.5, ease: "easeInOut" }} style={{ skewX: -20 }} />
        {[
          { v: d.stats.members, l: d.stats.members > 1 ? t("personnes") : t("personne") },
          { v: d.stats.generations, l: d.stats.generations > 1 ? t("générations") : t("génération") },
          { v: d.stats.memories, l: d.stats.memories > 1 ? t("souvenirs") : t("souvenir") },
          { v: d.stats.voiceValue, l: d.stats.voiceUnit === "h" ? t("h de voix") : t("min de voix"), dec: d.stats.voiceUnit === "h" ? 1 : 0 },
        ].map((s, i) => (
          <div key={i} className={`text-center ${i ? "border-l border-kapok" : ""}`}>
            <div className="font-serif text-[25px] text-foret">
              <CountUp to={s.v} decimals={s.dec} />
            </div>
            <div className="text-[11px] text-[#5A5A52]">{s.l}</div>
          </div>
        ))}
      </motion.div>

      <div className="flex flex-1 flex-col gap-5 px-4 pb-6 pt-5">
        {showSteps && (
          <motion.section {...fadeUp(0.85)} className="rounded-[22px] border border-or-pale bg-kapok/60 p-4">
            <h2 className="font-serif text-lg text-nuit">{t("Premiers pas")}</h2>
            <ul className="mt-2 flex flex-col">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="flex min-h-11 items-center gap-3 text-[14px]">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${s.done ? "border-foret bg-foret" : "border-or"}`}>
                      {s.done && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FAF7F1" strokeWidth="3" aria-hidden><path d="M5 12l5 5 9-10" /></svg>}
                    </span>
                    <span className={s.done ? "text-[#8B8475] line-through" : "text-foret"}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        <motion.div {...fadeUp(0.9)} className="relative flex items-center gap-3.5 overflow-hidden rounded-[22px] bg-nuit p-[18px]">
          <div className="absolute inset-0 bg-[radial-gradient(80%_120%_at_0%_50%,rgba(200,161,90,0.18),transparent_60%)]" />
          {d.featured ? (
            <>
              <div className="relative h-[58px] w-[58px] shrink-0">
                <span className="nr-ripple absolute inset-0 rounded-full border-[1.5px] border-or" />
                <Portrait size={58} src={mediaUrl(d.featured.photoId)} headwrap className="relative" />
              </div>
              <div className="relative min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[1.5px] text-or">{d.featured.audioId ? t("Une voix à écouter aujourd’hui") : t("Un récit à lire aujourd’hui")}</div>
                <Link href={`/membre/${d.featured.personId}`} className="mt-0.5 block truncate font-serif text-[17px] text-coton">{d.featured.title}</Link>
                <div className="mt-1.5 flex items-center gap-2">
                  {d.featured.audioId && <Waveform height={18} animated={playing} />}
                  <span className="truncate text-[11px] text-or-pale">{d.featured.audioId ? `${d.featured.personName} · ${d.featured.minutes} min` : `${d.featured.personName} · ${t("Récit écrit")}`}</span>
                </div>
              </div>
              {!d.featured.audioId && (
                <Link href={`/membre/${d.featured.personId}`} aria-label={t("Voir la fiche")} className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-or shadow-or">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#12261A" strokeWidth="2" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
                </Link>
              )}
              {d.featured.audioId && (
                <button data-silent onClick={togglePlay} aria-label={playing ? t("Pause") : t("Écouter le récit")} className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-or shadow-or">
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d={playing ? "M7 4h4v16H7zM14 4h4v16h-4z" : "M7 4l13 8-13 8z"} fill="#12261A" /></svg>
                </button>
              )}
            </>
          ) : (
            <div className="relative flex w-full items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[1.5px] text-or">{t("La voix des anciens")}</div>
                <p className="mt-1 font-serif text-[16px] leading-snug text-coton">{d.isAdmin ? t("Aucune voix enregistrée. Laissez un ancien raconter.") : t("Aucune voix enregistrée pour l’instant.")}</p>
              </div>
              {d.isAdmin && (
                <Link href="/ancien" aria-label={t("Enregistrer un récit")} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-or">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#12261A" strokeWidth="1.8" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
                </Link>
              )}
            </div>
          )}
        </motion.div>

        {d.annivs.length > 0 && (
          <motion.section {...fadeUp(1.0)}>
            <h2 className="mb-2.5 font-serif text-lg">{t("Anniversaires à venir")}</h2>
            <div className="divide-y divide-or-pale/50 overflow-hidden rounded-[20px] border border-or-pale/70 bg-white/70 shadow-doux">
              {d.annivs.map((a) => (
                <Link key={a.personId + a.kind} href={a.isLiving ? `/membre/${a.personId}` : `/memorial/${a.personId}`} className={`flex items-center gap-3 px-3.5 py-3 ${a.inDays === 0 ? "bg-or/15" : ""}`}>
                  <span className="relative shrink-0">
                    <Portrait size={42} src={mediaUrl(a.photoId)} />
                    <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-or ${a.kind === "birth" ? "bg-or-pale" : "bg-nuit"}`}>
                      {a.kind === "birth" ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden><path d="M12 2l2.6 6.2 6.6.6-5 4.4 1.5 6.6L12 16.4 6.3 19.8l1.5-6.6-5-4.4 6.6-.6z" fill="#8A6A2E" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden><path d="M1 10.5c2.2-.9 4.3-.8 6.2.2.6-2.6 2.5-4.6 5.1-5.3-.9 1.1-1.3 2.2-1.3 3.3 1.5-.3 3.1.1 4.5 1.2.5-.6 1.3-.9 2.2-.8-.5.5-.8 1.1-.9 1.8-.3 2.4-2.3 4.3-5 4.6-2.6.3-5-.7-6.6-2.6-1.3.1-2.8-.3-4.2-1.4z" fill="#E6D3A3" /></svg>
                      )}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 text-[14px] leading-snug text-ebene">
                    {a.kind === "death"
                      ? t("Il y a {n} ans, {p} nous quittait", { n: a.years, p: a.givenName })
                      : a.isLiving
                        ? a.inDays === 0
                          ? t("Joyeux anniversaire, {p} ! {n} ans", { n: a.years, p: a.givenName })
                          : t("{p} aura {n} ans", { n: a.years, p: a.givenName })
                        : a.sex === "f"
                          ? t("{p} aurait eu {n} ans", { n: a.years, p: a.givenName })
                          : t("{p} aurait eu {n} ans", { n: a.years, p: a.givenName })}
                  </span>
                  <span className={`shrink-0 text-[12px] ${a.inDays === 0 ? "font-semibold text-or-fonce" : "text-[#6B6455]"}`}>
                    {a.inDays === 0 ? t("Aujourd’hui") : a.inDays === 1 ? t("Demain") : t("Dans {j} j", { j: a.inDays })}
                  </span>
                </Link>
              ))}
            </div>
          </motion.section>
        )}

        <motion.div {...fadeUp(1.0)}>
          <Link href="/carte" className="relative flex items-center gap-4 overflow-hidden rounded-[22px] border border-or/40 bg-[linear-gradient(120deg,#12261A,#1F3D2B)] p-4 text-coton shadow-doux">
            <svg viewBox="-10 -10 420 424" className="h-14 w-14 shrink-0" aria-hidden>
              <path d={SHAPES.civ} fill="#2F5638" stroke="#C8A15A" strokeWidth="10" strokeLinejoin="round" />
              <circle cx="223" cy="243" r="22" fill="#C8A15A">
                <animate attributeName="r" values="18;30;18" dur="2.6s" repeatCount="indefinite" />
              </circle>
              <circle cx="257" cy="324" r="16" fill="#FAF7F1" />
            </svg>
            <span className="min-w-0 flex-1">
              <span className="block font-serif text-[18px]">{t("Notre terre")}</span>
              <span className="block text-[12px] leading-snug text-or-pale">{t("D’où nous venons, où nous vivons aujourd’hui : la famille sur la carte.")}</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C8A15A" strokeWidth="2" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
          </Link>
        </motion.div>

        {d.stats.members >= 3 && (
          <motion.div {...fadeUp(1.05)}>
            <Link href="/quiz" className="relative flex items-center gap-4 overflow-hidden rounded-[22px] border border-or/40 bg-[linear-gradient(120deg,#1F3D2B,#12261A)] p-4 text-coton shadow-doux">
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-or/50">
                <span className="nr-ripple absolute inset-0 rounded-full border border-or/40" />
                <span className="font-serif text-[30px] text-or">?</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-[18px]">{t("Quiz de la famille")}</span>
                <span className="block text-[12px] leading-snug text-or-pale">{t("Qui est le père de qui ? Quel est son plat favori ? Testez-vous !")}</span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C8A15A" strokeWidth="2" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
            </Link>
          </motion.div>
        )}

        <motion.section {...fadeUp(1.1)}>
          <h2 className="mb-2.5 font-serif text-lg">{t("Accès rapide")}</h2>
          <div className="grid grid-cols-4 gap-2">
            {(d.isAdmin
              ? [
                  { href: "/personne/nouvelle", label: t("Personne"), d: "M10 4a4 4 0 110 8 4 4 0 010-8zM3 20c1-4 4-6 7-6s6 2 7 6M19 8v6M16 11h6" },
                  { href: "/ancien", label: t("Récit"), d: "M9 3h6v11H9zM5 11a7 7 0 0014 0M12 18v3" },
                  { href: "/souvenir/nouveau", label: t("Souvenir"), d: "M4 7h3l2-3h6l2 3h3v12H4zM12 10a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" },
                  { href: "/qr", label: t("QR codes"), d: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3M21 14v7h-7" },
                ]
              : [
                  { href: "/arbre", label: t("Arbre"), d: "M12 3a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM12 8v4M12 12L5 16.5M12 12l7 4.5" },
                  { href: "/ancien", label: t("Écouter"), d: "M4 14v-2a8 8 0 0116 0v2M3 14h4v6H3zM17 14h4v6h-4z" },
                  { href: "/capsule", label: t("Capsule"), d: "M3 8h18v12H3zM3 12h18M7 8V5h10v3" },
                  { href: "/qr", label: t("QR codes"), d: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3M21 14v7h-7" },
                ]
            ).map((q) => (
              <Link key={q.href} href={q.href} className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-[18px] border border-or-pale bg-kapok text-[11px] text-foret hover:-translate-y-0.5 hover:bg-or-pale">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F3D2B" strokeWidth="1.6" aria-hidden><path d={q.d} /></svg>
                {q.label}
              </Link>
            ))}
          </div>
        </motion.section>

        <section>
          <motion.div {...fadeUp(1.2)} className="mb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-lg">{t("Derniers souvenirs")}</h2>
            {d.isAdmin && <Link href="/souvenir/nouveau" className="text-[13px] text-foret">{t("+ Ajouter")}</Link>}
          </motion.div>
          {d.memories.length === 0 ? (
            <p className="rounded-[18px] border border-dashed border-or-pale px-4 py-5 text-center text-sm text-[#6B6455]">
              {d.isAdmin ? t("Aucun souvenir encore. Ajoutez une vieille photo de famille.") : t("Aucun souvenir pour l’instant.")}
            </p>
          ) : (
            <div className="nr-no-scrollbar -mx-4 flex gap-3.5 overflow-x-auto px-4 pb-3 pt-1">
              {d.memories.map((m, i) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: [0, -5, 0] }} transition={{ opacity: { delay: 1.3 + i * 0.12, duration: 1 }, y: { delay: 2 + i * 0.4, duration: 6, repeat: Infinity, ease: "easeInOut" } }}>
                  <Polaroid caption={[m.caption, m.year].filter(Boolean).join(", ")} tilt={[-3, 2.5, -1.5, 2][i % 4]}>
                    {m.photoId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(m.photoId)} alt="" className="block aspect-[104/90] w-full object-cover [filter:sepia(.3)]" loading="lazy" />
                    ) : undefined}
                  </Polaroid>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
