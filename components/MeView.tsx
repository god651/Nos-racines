"use client";

import { getLink, linkSuffix } from "@/lib/local/sync";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { joinCode } from "@/lib/share-code";
import { useState } from "react";
import { api, mediaUrl } from "@/lib/client";
import { LANGS } from "@/lib/i18n/core";
import { useLang, useT } from "@/lib/i18n/client";
import { askConfirm } from "@/components/Confirm";
import type { Lang } from "@/lib/types";
import { Grain } from "./ambiance";
import { CodeEntry } from "./forms/CodeEntry";
import { CoffreKey, formatDate } from "./coffre/parts";
import { localCode } from "@/lib/local/coffre";
import { markGuide } from "./Guide";
import { otherAccounts, switchAccount } from "@/lib/local/accounts";
import { BottomNav } from "./BottomNav";
import { Portrait } from "./Portrait";
import { QrBox } from "./QrBox";
import { Card, ErrorNote, GhostButton, RoleBadge, Select } from "./ui";

export interface MeData {
  id: string;
  name: string;
  isAdmin: boolean;
  role?: string | null;
  since: number;
  familyName: string;
  lang: Lang;
  person: { id: string; name: string; photoId?: string } | null;
  options: { id: string; name: string }[];
  contributions: { stories: number; memories: number; capsulesSealed: number; capsulesOpen: number };
  isLastAdmin: boolean;
  isOwner: boolean;
  isCreator: boolean;
  keys: { id: string; title?: string; openDate: string; due: boolean; mine: boolean; byName: string }[];
}

export function MeView({ d }: { d: MeData }) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState(d.name);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<{ svg: string; link: string } | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deviceLink = () =>
    run(async () => {
      const { token } = await api<{ token: string }>("/api/invitations", "POST", { device: true });
      const link = joinCode(token, linkSuffix());
      setDevice({ link, svg: await QRCode.toString(link, { type: "svg", margin: 1, color: { dark: "#12261A", light: "#FAF7F1" } }) });
    });

  const c = d.contributions;
  const stats = [
    { n: c.stories, label: t("récits") },
    { n: c.memories, label: t("souvenirs") },
    { n: c.capsulesSealed + c.capsulesOpen, label: t("coffres") },
  ];

  return (
    <main className="flex min-h-dvh flex-col bg-coton">
      {/* En-tête personnel */}
      <section className="relative overflow-hidden bg-nuit px-5 pb-7 pt-[60px] text-coton">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_80%_0%,rgba(200,161,90,0.3),transparent_70%)]" />
        <Grain opacity={0.12} />
        <div className="relative flex items-center gap-4">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8 }}>
            <Portrait size={76} src={mediaUrl(d.person?.photoId)} />
          </motion.div>
          <div className="min-w-0 flex-1">
            <p className="font-main text-lg leading-none text-or">{t("Mon espace")}</p>
            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => api(`/api/utilisateurs/${d.id}`, "PATCH", { name })).then(() => setEditing(false));
                }}
                className="mt-1 flex gap-2"
              >
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} className="min-w-0 flex-1 rounded-[12px] bg-coton/10 px-3 py-2 font-serif text-xl text-coton outline-none" />
                <button className="rounded-full bg-or px-3 text-[13px] text-nuit">{t("OK")}</button>
              </form>
            ) : (
              <button onClick={() => setEditing(true)} className="mt-1 flex items-center gap-2 text-left">
                <h1 className="truncate font-serif text-[28px] font-light">{d.name}</h1>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E6D3A3" strokeWidth="1.7" aria-label={t("Modifier mon nom")}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
              </button>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {d.isCreator ? <span className="rounded-full bg-or px-2.5 py-1 text-[11px] font-semibold text-nuit">{t("Fondateur")}</span> : d.isOwner ? <span className="rounded-full border border-or px-2.5 py-1 text-[11px] font-semibold text-or">{t("Administrateur principal")}</span> : <RoleBadge admin={d.isAdmin} role={d.role} />}
              <span className="text-[11px] text-or-pale/80">{d.familyName}</span>
            </div>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-3 gap-2">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }} className="rounded-[16px] border border-or/25 bg-coton/5 px-3 py-2.5 text-center">
              <div className="font-serif text-2xl text-or">{s.n}</div>
              <div className="text-[11px] text-or-pale">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="flex-1 space-y-4 px-5 py-5">
        <ErrorNote message={error} />

        {/* Moi dans l'arbre */}
        <Card title={t("Moi dans l’arbre")} hint={d.person ? undefined : t("Reliez votre compte à votre fiche : le Griot comprendra « mon père », « ma grand-mère »…")}>
          {d.person ? (
            <div className="flex items-center gap-3">
              <Link href={`/membre/${d.person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Portrait size={44} src={mediaUrl(d.person.photoId)} />
                <span className="truncate font-serif text-[17px] text-nuit">{d.person.name}</span>
              </Link>
              <button disabled={busy} onClick={() => void run(() => api(`/api/utilisateurs/${d.id}`, "PATCH", { personId: null }))} className="text-[12px] text-[#9A917F] underline">
                {t("Changer")}
              </button>
            </div>
          ) : getLink() ? (
            <Link href="/moi/qui" className="block min-h-11 rounded-full bg-foret px-5 py-3 text-center text-[14px] font-semibold text-coton">
              {t("Qui suis-je dans l’arbre ?")}
            </Link>
          ) : d.options.length ? (
            <Select label={t("Je suis…")} defaultValue="" disabled={busy} onChange={(e) => e.target.value && void run(() => api(`/api/utilisateurs/${d.id}`, "PATCH", { personId: e.target.value }))}>
              <option value="" disabled>{t("Choisir ma fiche")}</option>
              {d.options.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </Select>
          ) : (
            <p className="text-sm text-[#6B6455]">{t("L’arbre est encore vide.")}</p>
          )}
          {d.isAdmin && !d.person && (
            <Link href="/personne/nouvelle?moi=1" className="mt-3 block text-[13px] text-or-fonce underline">
              {t("Je ne suis pas encore dans l’arbre : créer ma fiche")}
            </Link>
          )}
        </Card>

        {d.isCreator && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Link href="/fondateur" className="flex items-center gap-4 rounded-[22px] border border-or/50 bg-[linear-gradient(120deg,#1F3D2B,#12261A)] p-4 text-coton shadow-doux">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-or/60">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C8A15A" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-[18px]">{t("Espace du fondateur")}</span>
                <span className="block text-[12px] text-or-pale">{t("Activité, comptes et installations")}</span>
              </span>
            </Link>
          </motion.div>
        )}

        {d.keys.length > 0 && <MyKeys keys={d.keys} />}

        {/* Raccourcis */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/capsule", title: t("Mes coffres"), sub: c.capsulesSealed ? t("{n} scellée(s)", { n: c.capsulesSealed }) : t("Écrire au futur") },
            { href: "/qr", title: t("QR codes"), sub: d.isAdmin ? t("Arbre, invitations, fiches") : t("Arbre et fiches") },
            { href: "/carte", title: t("Notre terre"), sub: t("La famille sur la carte") },
            { href: "/parametres", title: t("Paramètres"), sub: t("Famille, langue, son…") },
            ...(d.isAdmin ? [{ href: getLink() ? "/parametres" : "/qr", title: t("Inviter un proche"), sub: getLink() ? t("Lecteur ou éditeur") : t("Lecture seule") }] : [{ href: "/arbre", title: t("L’arbre"), sub: t("Toute la famille") }]),
          ].map((x, i) => (
            <motion.div key={x.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
              <Link href={x.href} className="block h-full rounded-[18px] border border-or-pale/70 bg-white/70 p-3.5 shadow-doux">
                <span className="block font-serif text-[16px] text-nuit">{x.title}</span>
                <span className="block text-[12px] text-[#6B6455]">{x.sub}</span>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Langue rapide */}
        <Card title={t("Langue")}>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <button
                key={l.code}
                disabled={busy}
                onClick={() => void run(() => api("/api/langue", "POST", { lang: l.code }))}
                className={`rounded-full px-3.5 py-2 text-[13px] ${d.lang === l.code ? "bg-foret text-coton" : "border border-or-pale text-foret"}`}
              >
                {l.native}
              </button>
            ))}
          </div>
        </Card>

        {/* Autre téléphone (sans famille en ligne ; en ligne, on se connecte avec son e-mail) */}
        {!getLink() && <Card title={t("Ouvrir mon compte sur un autre téléphone")} hint={t("Scannez ce QR code avec l’autre téléphone : il s’ouvrira sur votre compte, avec les mêmes droits. Valable 30 minutes, une seule fois.")}>
          <AnimatePresence mode="wait">
            {device ? (
              <motion.div key="qr" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
                <div className="rounded-[18px] bg-coton p-2 shadow-doux">
                  <QrBox svg={device.svg} size={200} />
                </div>
                <button onClick={() => setDevice(null)} className="mt-3 text-[13px] text-[#6B6455] underline">{t("Masquer")}</button>
              </motion.div>
            ) : (
              <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <GhostButton disabled={busy} onClick={() => void deviceLink()} className="w-full">{t("Afficher le QR code")}</GhostButton>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              markGuide(d.id, false);
              router.push("/accueil");
            }}
            className="min-h-12 rounded-full border border-or text-[13px] text-or-fonce"
          >
            {t("Revoir le guide")}
          </button>
          <button onClick={() => window.dispatchEvent(new Event("nr-intro"))} className="min-h-12 rounded-full border border-or text-[13px] text-or-fonce">
            {t("Revoir le générique")}
          </button>
        </div>

        <OtherAccounts />

        <div className="pb-2 pt-2 text-center">
          <p className="text-[11px] text-[#9A917F]">{t("Membre depuis le {date}", { date: new Date(d.since).toLocaleDateString() })}</p>
          {d.isLastAdmin ? (
            <p className="mt-2 text-[12px] text-[#9A917F]">{d.isOwner ? t("Vous êtes l’administrateur principal : vous seul déléguez les droits d’administrateur, dans Paramètres.") : t("Vous êtes le seul administrateur : nommez-en un autre avant de quitter la famille.")}</p>
          ) : (
            <button
              disabled={busy}
              onClick={async () =>
                (await askConfirm(t("Quitter la famille sur ce téléphone ? Il faudra un nouveau QR code d’invitation pour revenir."))) &&
                void run(async () => {
                  await api(`/api/utilisateurs/${d.id}`, "DELETE");
                  router.replace("/bienvenue");
                })
              }
              className="mt-2 text-[12px] text-terre underline"
            >
              {t("Quitter la famille")}
            </button>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}

/** Les autres comptes ouverts sur ce téléphone, et l'entrée d'un code d'accès. */
function OtherAccounts() {
  const t = useT();
  const router = useRouter();
  const others = otherAccounts();
  return (
    <Card title={t("Comptes sur ce téléphone")} hint={others.length ? undefined : t("Un proche vous a donné un code d’accès ? Tapez-le ici pour ouvrir son compte sur ce téléphone.")}>
      {others.length > 0 && (
        <ul className="mb-3 divide-y divide-kapok">
          {others.map((a) => (
            <li key={a.token} className="flex items-center justify-between py-2.5">
              <span className="text-[15px] text-ebene">{a.name}</span>
              <button
                onClick={() => {
                  switchAccount(a.token);
                  router.replace("/accueil");
                  router.refresh();
                }}
                className="rounded-full border border-or px-3 py-1.5 text-[12px] text-or-fonce"
              >
                {t("Passer à ce compte")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <CodeEntry />
    </Card>
  );
}

/** Mes clés : bien visibles dans le profil, avec le code gravé dessus. */
function MyKeys({ keys }: { keys: MeData["keys"] }) {
  const t = useT();
  const lang = useLang();
  return (
    <section className="rounded-[22px] border border-or/40 bg-[linear-gradient(140deg,#1F3D2B,#12261A)] p-4 text-coton shadow-doux">
      <h2 className="font-serif text-[19px]">{t("Mes clés")}</h2>
      <p className="text-[12px] text-or-pale">{t("Chaque clé ouvre un coffre du futur. Le code est gravé dessus.")}</p>
      <div className="nr-no-scrollbar -mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-1">
        {keys.map((k) => (
          <Link key={k.id} href={`/capsule/${k.id}`} className="w-[190px] shrink-0 rounded-[18px] border border-or/25 bg-coton/5 p-3">
            <div className="flex justify-center">
              <CoffreKey code={localCode(k.id) ?? undefined} size={44} glow={k.due} />
            </div>
            <p className="mt-2 truncate font-serif text-[15px]">{k.title || t("Coffre du futur")}</p>
            <p className="text-[11px] text-or-pale">
              {k.mine ? (k.due ? t("ouvert le {date}", { date: formatDate(k.openDate, lang) }) : t("s’ouvre le {date}", { date: formatDate(k.openDate, lang) })) : t("reçue de {nom}", { nom: k.byName })}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
