"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, mediaUrl } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import { askConfirm } from "@/components/Confirm";
import { sound } from "@/lib/sound";
import type { Lang, ParentageKind, TimelineEvent, UnionKind } from "@/lib/types";
import { Grain } from "./ambiance";
import { Polaroid, Portrait } from "./Portrait";
import { QrBox } from "./QrBox";
import { Waveform } from "./Waveform";
import { LivingPortrait } from "./LivingPortrait";

export interface RelLink {
  id: string;
  name: string;
  photoId?: string;
  isLiving: boolean;
  years: string;
}

export interface MemberData {
  id: string;
  name: string;
  givenName: string;
  nickname?: string;
  sex: "f" | "m";
  birthYear?: number;
  deathYear?: number;
  isLiving: boolean;
  village?: string;
  city?: string;
  job?: string;
  ethnicity?: string;
  clan?: string;
  dayName?: string;
  dayNameMeaning?: string;
  bio?: string;
  quote?: string;
  favoriteDishes: string[];
  photoId?: string;
  photoIds: string[];
  animated: boolean;
  isPublic: boolean;
  generation: number;
  timeline: TimelineEvent[];
  stories: { id: string; title: string; text?: string; audioId?: string; durationSec: number }[];
  memories: { id: string; caption: string; year?: number; photoId?: string }[];
  parents: RelLink[];
  parentKind?: ParentageKind;
  spouses: (RelLink & { rank?: number; kind: UnionKind; separated?: boolean; separatedYear?: number })[];
  children: RelLink[];
  siblings: RelLink[];
  isMe: boolean;
  qrSvg: string;
  qrLink: string;
  isAdmin: boolean;
  lang: Lang;
  online: boolean;
}

const ease = [0.2, 0.7, 0.2, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 28, filter: "blur(4px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.9, ease },
};
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const TILTS = [-3, 2, -1.5, 3, -2.5, 1];

export function MemberView({ d }: { d: MemberData }) {
  const t = useT();
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scroller });
  // Parallaxe : la photo recule et s'estompe pendant que la page monte par-dessus.
  const heroY = useTransform(scrollY, [0, 420], [0, -190]);
  const heroScale = useTransform(scrollY, [0, 420], [1, 1.25]);
  const heroOpacity = useTransform(scrollY, [0, 420], [1, 0]);
  const barOpacity = useTransform(scrollY, [240, 320], [0, 1]);
  const [hint, setHint] = useState(true);
  useMotionValueEvent(scrollY, "change", (v) => setHint(v < 30));

  // Lecture des récits enregistrés, l'un après l'autre.
  const voiced = d.stories.filter((s) => s.audioId);
  const totalMin = Math.round(d.stories.reduce((a, s) => a + s.durationSec, 0) / 60);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [openStory, setOpenStory] = useState<string | null>(null);

  const stop = () => {
    audio.current?.pause();
    audio.current = null;
    setPlaying(null);
    sound.duck(false);
  };
  const play = (id: string) => {
    const st = voiced.find((s) => s.id === id);
    if (!st) return;
    audio.current?.pause();
    const a = new Audio(mediaUrl(st.audioId));
    audio.current = a;
    a.onended = () => {
      const next = voiced[voiced.findIndex((s) => s.id === id) + 1];
      if (next) play(next.id);
      else stop();
    };
    a.onerror = stop;
    sound.duck(true);
    a.play().then(() => setPlaying(id), stop);
  };
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Traduction de la biographie (Internet requis, une seule fois par visite).
  const [bioTr, setBioTr] = useState<string | null>(null);
  const [trBusy, setTrBusy] = useState(false);
  const [trErr, setTrErr] = useState<string | null>(null);
  const translateBio = async () => {
    if (bioTr) return setBioTr(null);
    setTrBusy(true);
    setTrErr(null);
    try {
      const r = await api<{ text: string }>("/api/traduire", "POST", { text: [d.quote, d.bio].filter(Boolean).join("\n\n"), target: d.lang });
      setBioTr(r.text);
    } catch (e) {
      setTrErr((e as Error).message);
    } finally {
      setTrBusy(false);
    }
  };

  const removeStory = async (id: string) => {
    if (!(await askConfirm(t("Supprimer ce récit ?")))) return;
    if (playing === id) stop();
    await api(`/api/recits/${id}`, "DELETE");
    router.refresh();
  };
  const removeMemory = async (id: string) => {
    if (!(await askConfirm(t("Retirer ce souvenir ?")))) return;
    await api(`/api/souvenirs/${id}`, "DELETE");
    router.refresh();
  };

  const born = d.sex === "f" ? t("née en {y}", { y: d.birthYear ?? "" }) : t("né en {y}", { y: d.birthYear ?? "" });
  const dates = d.deathYear ? `${d.birthYear ?? "?"} – ${d.deathYear}` : d.birthYear ? born : "";
  const chips = [
    d.nickname && t("Surnom : {x}", { x: d.nickname }),
    d.dayName && (d.dayNameMeaning ? t("Nom de jour : {x}, « {m} »", { x: d.dayName, m: d.dayNameMeaning }) : t("Nom de jour : {x}", { x: d.dayName })),
    [d.ethnicity, d.clan && t("clan {x}", { x: d.clan })].filter(Boolean).join(" · "),
    d.job,
    d.city && t("Vit à {x}", { x: d.city }),
  ].filter(Boolean) as string[];

  const KIND: Record<ParentageKind, string> = {
    biological: "",
    adoptive: t("adoption"),
    fostered: t("confié(e)"),
    guardianship: t("tutelle"),
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-nuit">
      {/* Photo plein écran (silhouette sépia tant qu'aucune photo n'est ajoutée). */}
      <motion.div style={{ y: heroY, scale: heroScale, opacity: heroOpacity }} className="absolute inset-x-0 top-0 h-[420px] origin-top overflow-hidden">
        {d.photoIds.length ? (
          <HeroPhotos ids={d.photoIds} living={d.isLiving} animated={!d.isLiving && d.animated} />
        ) : (
          <motion.svg
            viewBox="0 0 390 420"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full"
            initial={{ filter: "sepia(1) brightness(1.8) contrast(.4) blur(6px)" }}
            animate={{ filter: "sepia(.85) brightness(.8) contrast(.95) blur(0px)" }}
            transition={{ duration: 2.4 }}
            aria-hidden
          >
            <rect width="390" height="420" fill="#B89566" />
            {d.sex === "f" && <path d="M140 120c8-30 102-30 110 0 4 14-4 22-14 22H154c-10 0-18-8-14-22z" fill="#6E5432" />}
            <circle cx="195" cy="160" r="46" fill="#4A3520" />
            <path d="M90 420c10-100 50-160 105-160s95 60 105 160z" fill="#4A3520" />
          </motion.svg>
        )}
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_90%_15%,rgba(235,170,90,0.45),transparent_60%),linear-gradient(180deg,rgba(18,38,26,0.35),transparent_30%,rgba(18,38,26,0.95))]" />
        <Grain opacity={0.16} />
        <div className="absolute inset-x-6 bottom-14 text-coton">
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.9 }} className="mb-1.5 text-[11px] uppercase tracking-[2px] text-or">
            {t("Génération {n}", { n: ROMAN[d.generation - 1] ?? d.generation })}
            {d.isLiving ? "" : ` · ${t("En mémoire")}`}
            {d.isMe ? ` · ${t("C’est vous")}` : ""}
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.9 }} className="font-serif text-[38px] font-light leading-none">
            {d.name}
          </motion.h1>
          {(dates || d.village) && (
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.9 }} className="mt-1.5 font-main text-[21px] text-or-pale">
              {[dates, d.village].filter(Boolean).join(" · ")}
            </motion.p>
          )}
        </div>
      </motion.div>

      <div ref={scroller} className="nr-no-scrollbar absolute inset-0 overflow-y-auto overflow-x-hidden scroll-smooth">
        <div className="h-[392px]" />
        <article className="relative min-h-[calc(100dvh-120px)] rounded-t-[28px] bg-coton pb-20 shadow-[0_-12px_40px_rgba(0,0,0,0.25)]">
          {/* Voix */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3, duration: 0.8 }} className="relative -top-[26px] -mb-[26px] px-5">
            {voiced.length ? (
              <button
                onClick={() => (playing ? stop() : play(voiced[0].id))}
                aria-pressed={!!playing}
                data-silent
                className="flex min-h-[66px] w-full items-center gap-3.5 rounded-[22px] bg-or px-[18px] text-left text-nuit shadow-or"
              >
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-nuit">
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                    <path d={playing ? "M7 4h4v16H7zM14 4h4v16h-4z" : "M7 4l13 8-13 8z"} fill="#C8A15A" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{playing ? t("En écoute…") : t("Écouter sa voix")}</span>
                  <span className="block truncate text-xs">
                    {playing ? voiced.find((s) => s.id === playing)?.title : t("{n} récit(s) · {m} min", { n: d.stories.length, m: Math.max(1, totalMin) })}
                  </span>
                </span>
                <Waveform color="#12261A" animated={!!playing} />
              </button>
            ) : d.isAdmin ? (
              <Link href={`/ancien?personne=${d.id}`} className="flex min-h-[66px] w-full items-center gap-3.5 rounded-[22px] border border-or bg-coton px-[18px] text-left text-nuit shadow-doux">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-or">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#12261A" strokeWidth="1.8" aria-hidden>
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0014 0M12 18v3" />
                  </svg>
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{d.isLiving ? t("Enregistrer sa voix") : t("Ajouter un récit sur sa vie")}</span>
                  <span className="block text-xs text-[#6B6455]">{d.stories.length ? t("{n} récit(s) écrit(s), aucune voix encore", { n: d.stories.length }) : t("Aucun récit pour le moment")}</span>
                </span>
              </Link>
            ) : (
              <div className="rounded-[22px] border border-dashed border-or-pale bg-coton px-[18px] py-4 text-sm text-[#6B6455] shadow-doux">{d.stories.length ? t("{n} récit(s) écrit(s), aucune voix encore", { n: d.stories.length }) : t("Aucun récit pour le moment")}</div>
            )}
          </motion.div>

          {!d.isLiving && (
            <div className="px-5 pt-4">
              <Link href={`/memorial/${d.id}`} className="flex items-center gap-3 rounded-[18px] bg-nuit px-4 py-3 text-coton shadow-doux">
                <span className="font-serif text-[22px] italic text-or">Yako</span>
                <span className="flex-1 text-[13px] text-or-pale">{t("Son mémorial : bougies, mots et prières")}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C8A15A" strokeWidth="2" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
          )}

          {/* Actions administrateur */}
          {d.isAdmin && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="nr-no-scrollbar flex gap-2 overflow-x-auto px-5 pt-4">
              {[
                { href: `/membre/${d.id}/modifier`, label: t("Modifier la fiche"), strong: true },
                { href: `/ancien?personne=${d.id}`, label: t("+ Récit") },
                { href: `/souvenir/nouveau?personne=${d.id}`, label: t("+ Souvenir") },
                { href: `/personne/nouvelle?de=${d.id}`, label: t("+ Proche") },
              ].map((a) => (
                <Link key={a.href} href={a.href} className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] ${"strong" in a && a.strong ? "bg-foret text-coton" : "border border-or-pale bg-white/60 text-foret"}`}>
                  {a.label}
                </Link>
              ))}
            </motion.div>
          )}

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-5 pt-[18px]">
              {chips.map((c, i) => (
                <motion.span key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 + i * 0.1 }} className="rounded-xl bg-kapok px-2.5 py-1.5 text-xs text-foret">
                  {c}
                </motion.span>
              ))}
            </div>
          )}

          {/* Citation et biographie */}
          {(d.quote || d.bio) && (
            <div className="px-5 pt-[18px]">
              {d.quote && (
                <motion.p
                  initial={{ clipPath: "inset(0 100% 0 0)" }}
                  animate={{ clipPath: "inset(0 0% 0 0)" }}
                  transition={{ delay: 1.4, duration: 2.2, ease: [0.4, 0, 0.2, 1] }}
                  className="font-serif text-[19px] italic leading-snug text-foret"
                >
                  « {d.quote} »
                </motion.p>
              )}
              {d.bio && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#2A2A26]">{d.bio}</p>}
              {d.lang !== "fr" && d.online && (
                <div className="mt-3">
                  <button onClick={translateBio} disabled={trBusy} className="text-[13px] text-or-fonce underline underline-offset-4 disabled:opacity-50">
                    {trBusy ? t("Traduction…") : bioTr ? t("Voir l’original") : t("Traduire (Internet)")}
                  </button>
                  {trErr && <p className="mt-1 text-xs text-terre">{t(trErr)}</p>}
                  {bioTr && (
                    <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 whitespace-pre-line rounded-[14px] bg-kapok/60 p-3 text-sm leading-relaxed text-[#2A2A26]">
                      {bioTr}
                    </motion.p>
                  )}
                </div>
              )}
            </div>
          )}

          {d.favoriteDishes.length > 0 && (
            <section className="px-5">
              <motion.h2 {...reveal} className="mb-3 mt-8 font-serif text-[22px]">{t("Ses plats favoris")}</motion.h2>
              <div className="flex flex-wrap gap-2">
                {d.favoriteDishes.map((x, i) => (
                  <motion.span
                    key={x}
                    initial={{ opacity: 0, y: 10, rotate: -2 }}
                    whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.6 }}
                    className="flex items-center gap-2 rounded-[14px] border border-terre/25 bg-[#F6E7D8] px-3 py-2 text-[14px] text-[#5A2E1E]"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B5563A" strokeWidth="1.6" aria-hidden>
                      <path d="M3 12h18a9 9 0 01-18 0zM8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5M16 8c0-1.5 1-2 1-3.5" />
                    </svg>
                    {x}
                  </motion.span>
                ))}
              </div>
            </section>
          )}

          {!d.quote && !d.bio && chips.length === 0 && d.isAdmin && (
            <div className="px-5 pt-5">
              <Link href={`/membre/${d.id}/modifier`} className="block rounded-[18px] border border-dashed border-or bg-or/5 p-4 text-sm leading-relaxed text-[#5A4A22]">
                {t("Sa fiche est encore vide. Ajoutez son surnom, son nom de jour, son village, son métier, une phrase qu’il ou elle répétait…")}
              </Link>
            </div>
          )}

          {/* Famille proche */}
          {(d.parents.length > 0 || d.spouses.length > 0 || d.children.length > 0 || d.siblings.length > 0) && (
            <section className="px-5">
              <motion.h2 {...reveal} className="mb-3 mt-9 font-serif text-[22px]">{t("Sa famille")}</motion.h2>
              <div className="space-y-4">
                <RelRow title={d.parentKind && KIND[d.parentKind] ? `${t("Parents")} · ${KIND[d.parentKind]}` : t("Parents")} people={d.parents} />
                <RelRow
                  title={d.spouses.length > 1 ? t("Conjoints") : t("Conjoint")}
                  people={d.spouses.map((s) => ({ ...s, years: s.separated ? (s.separatedYear ? t("séparés en {a}", { a: s.separatedYear }) : t("séparés")) : s.rank && d.spouses.length > 1 ? t("{n}e union", { n: s.rank }) : s.years }))}
                />
                <RelRow title={t("Enfants")} people={d.children} />
                <RelRow title={t("Frères et sœurs")} people={d.siblings} />
              </div>
            </section>
          )}

          {/* Récits */}
          {d.stories.length > 0 && (
            <section className="px-5">
              <motion.h2 {...reveal} className="mb-3 mt-9 font-serif text-[22px]">{t("Ses récits")}</motion.h2>
              <div className="space-y-2.5">
                {d.stories.map((st) => (
                  <motion.div key={st.id} {...reveal} className="rounded-[18px] border border-or-pale/70 bg-white/70 p-3.5 shadow-doux">
                    <div className="flex items-center gap-3">
                      {st.audioId ? (
                        <button
                          data-silent
                          onClick={() => (playing === st.id ? stop() : play(st.id))}
                          aria-label={playing === st.id ? t("Pause") : t("Écouter")}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-nuit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                            <path d={playing === st.id ? "M7 4h4v16H7zM14 4h4v16h-4z" : "M7 4l13 8-13 8z"} fill="#C8A15A" />
                          </svg>
                        </button>
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-kapok">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1F3D2B" strokeWidth="1.8" aria-hidden><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></svg>
                        </span>
                      )}
                      <button onClick={() => setOpenStory(openStory === st.id ? null : st.id)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate font-serif text-base text-nuit">{st.title}</span>
                        <span className="block text-xs text-[#6B6455]">
                          {st.audioId ? t("{m} min de voix", { m: Math.max(1, Math.round(st.durationSec / 60)) }) : t("Récit écrit")}
                          {st.text ? ` · ${openStory === st.id ? t("masquer") : t("lire")}` : ""}
                        </span>
                      </button>
                      {playing === st.id && <Waveform color="#C8A15A" height={20} />}
                      {d.isAdmin && (
                        <button onClick={() => removeStory(st.id)} aria-label={t("Supprimer")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#9A917F]">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></svg>
                        </button>
                      )}
                    </div>
                    {openStory === st.id && st.text && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#2A2A26]">
                        {st.text}
                      </motion.p>
                    )}
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Frise de vie */}
          {d.timeline.length > 0 && (
            <section className="px-5">
              <motion.h2 {...reveal} className="mb-3.5 mt-9 font-serif text-[22px]">{t("Sa vie, année après année")}</motion.h2>
              <div className="relative">
                <motion.span
                  aria-hidden
                  className="absolute bottom-1.5 left-[11px] top-1.5 w-[1.5px] origin-top bg-or-pale"
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 1.6, ease }}
                />
                {d.timeline.map((ev, i) => (
                  <motion.div key={ev.year + ev.text + i} {...reveal} className="flex gap-3.5 pb-3.5 pt-1.5">
                    <span className={`h-6 w-6 shrink-0 rounded-full shadow-[0_0_0_4px_#FAF7F1] ${i === 0 ? "bg-or" : i === d.timeline.length - 1 ? "bg-or-pale" : "bg-foret"}`} />
                    <div>
                      <div className="font-serif text-base text-or-fonce">{ev.year}</div>
                      <div className="text-sm text-[#2A2A26]">{ev.text}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Souvenirs */}
          {(d.memories.length > 0 || d.isAdmin) && (
            <section id="souvenirs" className="px-5">
              <motion.h2 {...reveal} className="mb-4 mt-9 font-serif text-[22px]">{t("Souvenirs")}</motion.h2>
              {d.memories.length ? (
                <div className="nr-no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-3 pt-1">
                  {d.memories.map((m, i) => (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 1, ease }} className="relative">
                      <Polaroid caption={m.year ? `${m.caption} · ${m.year}` : m.caption} tilt={TILTS[i % TILTS.length]} width={132}>
                        {m.photoId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaUrl(m.photoId)} alt="" loading="lazy" className="block aspect-[104/90] w-full object-cover [filter:sepia(.35)_contrast(1.02)]" />
                        ) : undefined}
                      </Polaroid>
                      {d.isAdmin && (
                        <button onClick={() => removeMemory(m.id)} aria-label={t("Retirer")} className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-coton text-[#9A917F] shadow">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Link href={`/souvenir/nouveau?personne=${d.id}`} className="block rounded-[18px] border border-dashed border-or bg-or/5 p-4 text-sm text-[#5A4A22]">
                  {t("Ajoutez une première photo souvenir.")}
                </Link>
              )}
            </section>
          )}

          {/* QR code de la fiche */}
          <section className="px-5">
            <motion.h2 {...reveal} className="mb-4 mt-10 font-serif text-[22px]">{t("Son QR code")}</motion.h2>
            <motion.div {...reveal} className="flex items-center gap-4 rounded-[18px] bg-nuit p-4 text-coton">
              <div className="shrink-0 rounded-xl bg-coton p-1.5">
                <QrBox svg={d.qrSvg} size={120} />
              </div>
              <div className="min-w-0 text-sm leading-relaxed">
                {d.isPublic ? t("À imprimer sous son portrait, sur le poster, une plaque ou un cadre.") : t("Sa fiche est réservée à la famille : le QR code ne montrera que son nom à un inconnu.")}
                <a href={d.qrLink} className="mt-2 block break-all text-xs text-or-pale underline">
                  {d.qrLink.replace(/^https?:\/\//, "")}
                </a>
                <Link href="/qr" className="mt-2 inline-block text-xs text-or underline">
                  {t("Tous les QR codes à imprimer")}
                </Link>
              </div>
            </motion.div>
          </section>
        </article>
      </div>

      <motion.div style={{ opacity: barOpacity }} className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-[104px] items-end justify-center border-b border-or/25 bg-coton/90 pb-[18px] backdrop-blur-xl">
        <span className="font-serif text-[17px] text-nuit">{d.name}</span>
      </motion.div>

      <div className="absolute inset-x-4 top-[52px] z-20 flex justify-between">
        <Link href={`/arbre?p=${d.id}`} aria-label={t("Retour à l’arbre")} className="flex h-11 w-11 items-center justify-center rounded-full border border-or-pale/25 bg-nuit/45 backdrop-blur-md">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E6D3A3" strokeWidth="1.8" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
        </Link>
        {d.isAdmin && (
          <Link href={`/membre/${d.id}/modifier`} aria-label={t("Modifier la fiche")} className="flex h-11 w-11 items-center justify-center rounded-full border border-or-pale/25 bg-nuit/45 backdrop-blur-md">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#E6D3A3" strokeWidth="1.7" aria-hidden><path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" /></svg>
          </Link>
        )}
      </div>

      <motion.div animate={{ opacity: hint ? 1 : 0, y: hint ? 0 : 10 }} className="pointer-events-none absolute bottom-[18px] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center rounded-full bg-coton/90 px-4 pb-1 pt-1.5 text-[11px] tracking-wide text-[#6B5A30] shadow-doux backdrop-blur-md">
        {t("Faites défiler sa vie")}
        <motion.svg animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A6A2E" strokeWidth="2" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </motion.svg>
      </motion.div>
    </main>
  );
}

function RelRow({ title, people }: { title: string; people: RelLink[] }) {
  if (!people.length) return null;
  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-[1.5px] text-or-fonce">{title}</p>
      <div className="nr-no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5">
        {people.map((p) => (
          <Link key={p.id} href={`/membre/${p.id}`} className="flex w-[84px] shrink-0 flex-col items-center text-center">
            <span className={p.isLiving ? "" : "opacity-80 grayscale-[.4]"}>
              <Portrait size={56} src={mediaUrl(p.photoId)} />
            </span>
            <span className="mt-1.5 line-clamp-2 text-[12px] leading-tight text-nuit">{p.name}</span>
            {p.years && <span className="text-[10px] text-[#8A8270]">{p.years}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Jusqu'à 3 photos en fondu enchaîné lent, avec léger zoom. */
function HeroPhotos({ ids, living, animated }: { ids: string[]; living: boolean; animated: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (ids.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % ids.length), 6000);
    return () => clearInterval(id);
  }, [ids.length]);
  return (
    <>
      {animated ? (
        <AnimatePresence initial={false}>
          <motion.div key={ids[i]} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.8 }}>
            <LivingPortrait src={mediaUrl(ids[i])!} className="h-full w-full" filter="sepia(.6) brightness(.85)" intensity={0.8} />
          </motion.div>
        </AnimatePresence>
      ) : (
      <AnimatePresence initial={false}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img
          key={ids[i]}
          src={mediaUrl(ids[i])}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0, filter: "sepia(1) brightness(1.6) contrast(.5) blur(6px)", scale: 1.1 }}
          animate={{ opacity: 1, filter: `sepia(${living ? 0.25 : 0.6}) brightness(.85) contrast(1) blur(0px)`, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 1.6 } }}
          transition={{ duration: 2.2 }}
        />
      </AnimatePresence>
      )}
      {ids.length > 1 && (
        <div className="absolute right-5 top-[112px] z-10 flex flex-col gap-1.5">
          {ids.map((id, k) => (
            <button key={id} onClick={() => setI(k)} aria-label={`${k + 1}/${ids.length}`} className={`h-2 w-2 rounded-full transition-colors ${k === i ? "bg-or" : "bg-coton/40"}`} />
          ))}
        </div>
      )}
    </>
  );
}
