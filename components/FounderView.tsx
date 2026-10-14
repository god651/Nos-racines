"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { dayKey, readOpens } from "@/lib/activity";
import { useT } from "@/lib/i18n/client";
import { kv } from "@/lib/local/store-core";
import { RELEASES_URL } from "@/lib/native";
import { cloudAvailable, creatorStats, getLink } from "@/lib/local/sync";
import { BackButton } from "./ui";

// Tableau de bord du fondateur : chiffres de la famille, activité jour par jour,
// comptes, et (avec le code créateur) les téléchargements de l'application.

export type FeedKind = "personne" | "recit" | "souvenir" | "bougie" | "mot" | "quiz" | "compte" | "capsule";
export interface FeedItem {
  at: number;
  kind: FeedKind;
  text: string;
  who?: string;
}
interface Totals {
  persons: number;
  stories: number;
  voiceMin: number;
  memories: number;
  capsules: number;
  candles: number;
  messages: number;
  quiz: number;
  photos: number;
}
interface Account {
  id: string;
  name: string;
  admin: boolean;
  owner: boolean;
  creator: boolean;
  since: number;
  lastSeen?: number;
}

const CREATOR_HASH = "e9e3ad901f54efca088eff991740713021e26c52929ff1e23572aed296f9ac33";
const DAYS = 30;

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function FounderView({ familyName, since, totals, accounts, feed }: { familyName: string; since: number; totals: Totals; accounts: Account[]; feed: FeedItem[] }) {
  const t = useT();
  const LABEL: Record<FeedKind, string> = {
    personne: t("Nouvelle personne dans l’arbre"),
    recit: t("Récit enregistré"),
    souvenir: t("Souvenir ajouté"),
    bougie: t("Bougie allumée pour"),
    mot: t("Mot laissé pour"),
    quiz: t("Partie de quiz"),
    compte: t("Nouveau compte"),
    capsule: t("Capsule scellée jusqu’en"),
  };

  // 30 derniers jours : ajouts (tout ce qui a été créé) et ouvertures de l'application ici.
  const days = useMemo(() => {
    const out: { key: string; label: string; adds: number; opens: number }[] = [];
    const opens = readOpens();
    const counts = new Map<string, number>();
    for (const f of feed) counts.set(dayKey(f.at), (counts.get(dayKey(f.at)) ?? 0) + 1);
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const k = dayKey(d.getTime());
      out.push({ key: k, label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }), adds: counts.get(k) ?? 0, opens: opens[k] ?? 0 });
    }
    return out;
  }, [feed]);
  const week = days.slice(-7);
  const tiles = [
    { n: totals.persons, l: t("personnes") },
    { n: accounts.length, l: t("comptes") },
    { n: totals.stories, l: t("récits") },
    { n: totals.voiceMin, l: t("min de voix") },
    { n: totals.memories + totals.photos, l: t("photos et souvenirs") },
    { n: totals.candles + totals.messages, l: t("bougies et mots") },
    { n: totals.quiz, l: t("parties de quiz") },
    { n: totals.capsules, l: t("capsules") },
  ];

  return (
    <main className="min-h-dvh bg-nuit pb-16 text-coton">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[300px] bg-[radial-gradient(70%_60%_at_80%_0%,rgba(200,161,90,0.25),transparent_70%)]" />
      <header className="relative flex items-center gap-3 px-5 pb-3 pt-[52px]">
        <BackButton href="/moi" dark />
        <div className="min-w-0 flex-1">
          <p className="font-main text-lg leading-none text-or">{familyName}</p>
          <h1 className="truncate font-serif text-[26px] font-light">{t("Espace du fondateur")}</h1>
        </div>
      </header>
      <p className="relative mx-5 text-[13px] text-or-pale">{t("Visible par vous seul. La famille est sur Nos Racines depuis le {d}.", { d: new Date(since).toLocaleDateString() })}</p>

      {/* Cette semaine */}
      <section className="relative mx-5 mt-5 grid grid-cols-2 gap-2">
        <Hero n={week.reduce((s, d) => s + d.opens, 0)} l={t("ouvertures cette semaine")} />
        <Hero n={week.reduce((s, d) => s + d.adds, 0)} l={t("ajouts cette semaine")} />
      </section>

      <section className="relative mx-5 mt-3 grid grid-cols-4 gap-2">
        {tiles.map((x, i) => (
          <motion.div key={x.l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="rounded-[16px] border border-or/15 bg-white/5 px-1.5 py-3 text-center">
            <p className="font-serif text-[22px] leading-none text-or">{x.n}</p>
            <p className="mt-1 text-[10px] leading-tight text-or-pale">{x.l}</p>
          </motion.div>
        ))}
      </section>

      <Bars title={t("Ajouts dans la famille, jour par jour")} days={days} pick={(d) => d.adds} />
      <Bars title={t("Ouvertures de l’application sur ce téléphone")} days={days} pick={(d) => d.opens} />

      {/* Fil d'activité */}
      <section className="relative mx-5 mt-7">
        <h2 className="font-serif text-[20px]">{t("Dernières activités")}</h2>
        {feed.length === 0 ? (
          <p className="mt-2 text-[13px] text-or-pale">{t("Rien pour le moment.")}</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {feed.slice(0, 15).map((f, i) => (
              <li key={i} className="flex gap-3 rounded-[14px] bg-white/5 px-3 py-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-or" />
                <span className="min-w-0 flex-1 text-[13px] leading-snug">
                  {LABEL[f.kind]} <span className="text-or-pale">{f.text}</span>
                  {f.who && <span className="block text-[11px] text-coton/50">{t("par {nom}", { nom: f.who })}</span>}
                </span>
                <span className="shrink-0 text-[11px] text-coton/50">{ago(f.at, t)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Comptes */}
      <section className="relative mx-5 mt-7">
        <h2 className="font-serif text-[20px]">{t("Les comptes de la famille")}</h2>
        <div className="mt-3 space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-[14px] bg-white/5 px-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-or/40 font-serif text-or">{a.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px]">{a.name}</span>
                <span className="block text-[11px] text-or-pale">{a.creator ? t("Fondateur") : a.owner ? t("Administrateur principal") : a.admin ? t("Administrateur") : t("Membre")} · {t("depuis le {d}", { d: new Date(a.since).toLocaleDateString() })}</span>
              </span>
              <span className="shrink-0 text-right text-[11px] text-coton/50">{a.lastSeen ? ago(a.lastSeen, t) : t("pas encore connecté ici")}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-coton/45">
          {getLink() ? t("Avec le partage en direct, les ajouts, les bougies et les mots viennent de tous les téléphones de la famille. Les dates de connexion sont celles de ce téléphone.") : t("Ces chiffres viennent de ce téléphone. Activez le partage en direct (Paramètres) pour voir l’activité de toute la famille.")}
        </p>
      </section>

      <AppStats />
    </main>
  );
}

function Hero({ n, l }: { n: number; l: string }) {
  return (
    <div className="rounded-[20px] border border-or/30 bg-[linear-gradient(140deg,#1F3D2B,#12261A)] p-4">
      <p className="font-serif text-[40px] leading-none text-or">{n}</p>
      <p className="mt-1 text-[12px] text-or-pale">{l}</p>
    </div>
  );
}

function ago(at: number, t: ReturnType<typeof useT>) {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 60) return t("il y a {n} min", { n: Math.max(1, m) });
  const h = Math.round(m / 60);
  if (h < 24) return t("il y a {n} h", { n: h });
  const d = Math.round(h / 24);
  return d < 30 ? t("il y a {n} j", { n: d }) : new Date(at).toLocaleDateString();
}

type Day = { key: string; label: string; adds: number; opens: number };
function Bars({ title, days, pick }: { title: string; days: Day[]; pick: (d: Day) => number }) {
  const t = useT();
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...days.map(pick));
  const total = days.reduce((s, d) => s + pick(d), 0);
  const W = 340;
  const H = 110;
  const bw = W / days.length;
  return (
    <section className="relative mx-5 mt-6 rounded-[20px] border border-or/15 bg-white/[0.03] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] text-coton/90">{title}</h2>
        <span className="shrink-0 text-[12px] text-or-pale">{t("{n} en 30 jours", { n: total })}</span>
      </div>
      <div className="relative mt-3">
        <AnimatePresence>
          {sel !== null && (
            <motion.div key={sel} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-[10px] bg-coton px-2 py-1 text-[11px] text-nuit shadow" style={{ left: `${((sel + 0.5) / days.length) * 100}%` }}>
              <b>{pick(days[sel])}</b> · {days[sel].label}
            </motion.div>
          )}
        </AnimatePresence>
        <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" onPointerLeave={() => setSel(null)} role="img" aria-label={title}>
          <line x1="0" x2={W} y1={H} y2={H} stroke="#E6D3A3" strokeOpacity="0.2" />
          {days.map((d, i) => {
            const v = pick(d);
            const h = v ? Math.max(3, (v / max) * (H - 22)) : 0;
            const x = i * bw + 1.5;
            const w = bw - 3;
            return (
              <g key={d.key} onPointerEnter={() => setSel(i)} onPointerDown={() => setSel(i)}>
                <rect x={i * bw} y="0" width={bw} height={H} fill="transparent" />
                {h > 0 && (
                  <motion.path
                    d={`M${x} ${H}V${H - h + 4}q0-4 4-4h${w - 8}q4 0 4 4V${H}z`}
                    fill={sel === i ? "#FFF3D6" : "#C8A15A"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.015 }}
                  />
                )}
              </g>
            );
          })}
          <text x="0" y={H + 13} fontSize="9" fill="#E6D3A3" fillOpacity="0.6">{days[0].label}</text>
          <text x={W} y={H + 13} fontSize="9" textAnchor="end" fill="#E6D3A3" fillOpacity="0.6">{t("aujourd’hui")}</text>
        </svg>
      </div>
    </section>
  );
}

/** Téléchargements de l'application (GitHub) — réservé au créateur, avec son code. */
function AppStats() {
  const t = useT();
  const [ok, setOk] = useState(() => kv.get("nr_createur") === "1");
  const [pin, setPin] = useState("");
  const [bad, setBad] = useState(false);
  const [rel, setRel] = useState<{ v: string; apk: number; maj: number; date: string; draft: boolean }[] | null>(null);
  const [err, setErr] = useState(false);
  const repo = RELEASES_URL.match(/github\.com\/([^/]+\/[^/]+)/)?.[1];

  useEffect(() => {
    if (!ok || !repo) return;
    fetch(`https://api.github.com/repos/${repo}/releases?per_page=30`, { headers: { Accept: "application/vnd.github+json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((list: { tag_name: string; draft: boolean; published_at?: string; created_at: string; assets: { name: string; download_count: number }[] }[]) =>
        setRel(
          list
            .filter((x) => !x.draft)
            .map((x) => ({
              v: x.tag_name.replace(/^v/, ""),
              apk: x.assets.find((a) => a.name.endsWith(".apk"))?.download_count ?? 0,
              maj: x.assets.find((a) => a.name.endsWith(".zip"))?.download_count ?? 0,
              date: new Date(x.published_at ?? x.created_at).toLocaleDateString(),
              draft: x.draft,
            })),
        ),
      )
      .catch(() => setErr(true));
  }, [ok, repo]);

  return (
    <section className="relative mx-5 mt-8 rounded-[22px] border border-or/40 bg-[linear-gradient(140deg,#1F3D2B,#12261A)] p-4">
      <h2 className="font-serif text-[20px]">{t("Votre application")}</h2>
      {!ok ? (
        <form
          className="mt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if ((await sha256(`nos-racines-createur:${pin.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")}`)) === CREATOR_HASH) {
              kv.set("nr_createur", "1");
              kv.set("nr_createur_pin", pin.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""));
              setOk(true);
            } else setBad(true);
          }}
        >
          <p className="text-[12px] leading-relaxed text-or-pale">{t("Les téléchargements et les mises à jour de l’application, réservés au créateur. Entrez votre code créateur.")}</p>
          <div className="mt-3 flex gap-2">
            <input value={pin} onChange={(e) => (setPin(e.target.value), setBad(false))} placeholder="••••••••" autoCapitalize="characters" className="min-w-0 flex-1 rounded-[14px] border border-or/30 bg-white/5 px-4 py-2.5 text-center font-serif tracking-[3px] text-coton outline-none focus:border-or" />
            <button className="rounded-full bg-or px-4 text-[13px] font-semibold text-nuit">{t("Ouvrir")}</button>
          </div>
          {bad && <p className="mt-2 text-[12px] text-terre">{t("Code incorrect.")}</p>}
        </form>
      ) : !repo ? (
        <p className="mt-2 text-[13px] text-or-pale">{t("Disponible dans l’application installée depuis GitHub.")}</p>
      ) : err ? (
        <p className="mt-2 text-[13px] text-or-pale">{t("Pas de connexion pour le moment. Réessayez plus tard.")}</p>
      ) : !rel ? (
        <p className="mt-2 text-[13px] text-or-pale">…</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Hero n={rel.reduce((s, r) => s + r.apk, 0)} l={t("téléchargements de l’application")} />
            <Hero n={rel[0]?.maj ?? 0} l={t("téléphones à jour (dernière version)")} />
          </div>
          <div className="mt-3 space-y-1.5">
            {rel.slice(0, 8).map((r) => (
              <div key={r.v} className="flex items-center justify-between rounded-[12px] bg-white/5 px-3 py-2 text-[12px]">
                <span>
                  {t("Version {v}", { v: r.v })} <span className="text-coton/50">· {r.date}</span>
                </span>
                <span className="text-or-pale">
                  {t("{a} installations · {b} mises à jour", { a: r.apk, b: r.maj })}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-coton/45">{t("Chiffres publics de GitHub : chaque téléchargement du fichier d’installation, et chaque téléphone qui a reçu une mise à jour.")}</p>
          <CloudStats />
        </>
      )}
    </section>
  );
}

type CS = Awaited<ReturnType<typeof creatorStats>>;
/** Tous les téléphones reliés au partage en direct (toutes familles confondues), sans aucune donnée personnelle. */
function CloudStats() {
  const t = useT();
  const [s, setS] = useState<CS>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    const pin = kv.get("nr_createur_pin");
    if (!cloudAvailable || !pin) return;
    creatorStats(pin).then(setS).catch(() => setErr(true));
  }, []);
  if (!cloudAvailable) return null;
  if (err) return <p className="mt-4 text-[12px] text-or-pale">{t("Statistiques en ligne indisponibles pour le moment.")}</p>;
  if (!s) return null;
  const days: Day[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    days.push({ key: k, label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }), adds: s.adds.find((x) => x.day === k)?.n ?? 0, opens: s.days.find((x) => x.day === k)?.phones ?? 0 });
  }
  return (
    <div className="mt-5">
      <h3 className="font-serif text-[17px]">{t("Partage en direct")}</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Hero n={s.families} l={t("familles")} />
        <Hero n={s.devices} l={t("téléphones reliés")} />
        <Hero n={s.active1} l={t("actifs aujourd’hui")} />
        <Hero n={s.active7} l={t("actifs cette semaine")} />
      </div>
      <div className="-mx-5">
        <Bars title={t("Téléphones actifs, jour par jour")} days={days} pick={(d) => d.opens} />
        <Bars title={t("Ajouts partagés, jour par jour")} days={days} pick={(d) => d.adds} />
      </div>
      <p className="mt-3 text-[11px] text-coton/45">
        {t("Versions en service")} : {Object.entries(s.versions).map(([v, n]) => `${v} (${n})`).join(" · ") || "—"}
      </p>
    </div>
  );
}
