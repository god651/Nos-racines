"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Dust, Grain, Vignette } from "@/components/ambiance";
import { DateField } from "@/components/forms/DateField";
import { useLang, useT } from "@/lib/i18n/client";
import { normCode, sealCapsule, type NewItem } from "@/lib/local/coffre";
import { read } from "@/lib/local/store-core";
import { sound } from "@/lib/sound";
import type { CapsuleRecipient, User } from "@/lib/types";
import { BackButton } from "../ui";
import { ItemsEditor } from "./ItemsEditor";
import { CoffreKey, formatDate } from "./parts";

// Laisser un coffre : pour qui, quand, quoi, et la clé.

export interface CreateData {
  me: User;
  suggestions: { label: string; to: CapsuleRecipient[] }[];
  people: { id: string; name: string; kind: "person" | "user" }[];
}

const STEPS = ["Pour qui ?", "Quand ?", "Ce que vous laissez", "La clé"] as const;

export function CoffreCreate({ d }: { d: CreateData }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [to, setTo] = useState<CapsuleRecipient[]>([]);
  const [q, setQ] = useState("");
  const [openAt, setOpenAt] = useState("");
  const [items, setItems] = useState<NewItem[]>([]);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [code2, setCode2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const has = (r: CapsuleRecipient) => to.some((x) => x.kind === r.kind && x.id === r.id);
  const toggle = (r: CapsuleRecipient) => setTo(has(r) ? to.filter((x) => !(x.kind === r.kind && x.id === r.id)) : r.kind === "all" ? [r] : [...to.filter((x) => x.kind !== "all"), r]);
  const addGroup = (list: CapsuleRecipient[]) => setTo(list[0]?.kind === "all" ? list : [...to.filter((x) => x.kind !== "all" && !list.some((l) => l.kind === x.kind && l.id === x.id)), ...list]);
  const found = useMemo(() => {
    const n = q.trim().toLowerCase();
    return d.people.filter((p) => !n || p.name.toLowerCase().includes(n)).slice(0, 30);
  }, [q, d.people]);

  const quick = (years: number) => {
    const x = new Date();
    x.setFullYear(x.getFullYear() + years);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };
  const cc = normCode(code);
  const ok = [to.length > 0, !!openAt, items.length > 0, cc.length >= 1 && cc === normCode(code2)][step];

  async function seal() {
    setBusy(true);
    setErr(null);
    try {
      const id = await sealCapsule({ me: d.me, title, openAt, to, code: cc, items });
      sound.play("seal");
      setTimeout(() => sound.play("success"), 1200);
      router.replace(`/capsule/${id}?scelle=1`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-nuit px-5 pb-10 pt-[52px] text-coton">
      <Vignette glow="rgba(200,161,90,0.2)" at="50% 20%" />
      <Dust />
      <Grain opacity={0.08} />
      <header className="relative flex items-center gap-3">
        <BackButton href="/capsule" dark />
        <div>
          <p className="font-main text-lg leading-none text-or">{t("un coffre pour le futur")}</p>
          <h1 className="font-serif text-[26px] font-light">{t(STEPS[step])}</h1>
        </div>
      </header>
      <div className="relative mt-4 flex gap-1.5">
        {STEPS.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-or" : "bg-or-pale/20"}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.section key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35 }} className="relative mt-6">
          {step === 0 && (
            <>
              <p className="text-[13px] text-or-pale">{t("Choisissez une ou plusieurs propositions, ou des personnes précises.")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {d.suggestions.map((s) => {
                  const on = s.to.every(has);
                  return (
                    <button key={s.label} type="button" onClick={() => (on ? setTo(to.filter((x) => !s.to.some((r) => r.kind === x.kind && r.id === x.id))) : addGroup(s.to))} className={`min-h-11 rounded-full border px-4 text-[14px] ${on ? "border-or bg-or font-semibold text-nuit" : "border-or-pale/35"}`}>
                      {t(s.label)}
                    </button>
                  );
                })}
              </div>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Chercher une personne de la famille…")} className="mt-5 w-full rounded-[14px] border border-or-pale/25 bg-coton/5 px-4 py-3 text-[15px] text-coton outline-none placeholder:text-or-pale/40 focus:border-or" />
              <div className="mt-2 max-h-[38vh] space-y-1.5 overflow-y-auto">
                {found.map((p) => {
                  const r: CapsuleRecipient = { kind: p.kind, id: p.id, label: p.name };
                  const on = has(r);
                  return (
                    <button key={p.kind + p.id} type="button" onClick={() => toggle(r)} className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[14px] ${on ? "bg-or/20" : "bg-coton/5"}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-[6px] border ${on ? "border-or bg-or text-nuit" : "border-or-pale/40"}`}>{on ? "✓" : ""}</span>
                      {p.name}
                    </button>
                  );
                })}
              </div>
              {to.length > 0 && <p className="mt-3 text-[13px] text-or">{t("Pour : {liste}", { liste: to.map((x) => (x.kind === "all" ? t(x.label) : x.label)).join(", ") })}</p>}
            </>
          )}

          {step === 1 && (
            <>
              <p className="mb-3 text-[13px] text-or-pale">{t("Le jour où le coffre s’ouvrira. Tapez la date, ou choisissez :")}</p>
              <div className="mb-4 flex flex-wrap gap-2">
                {[1, 5, 10, 20].map((n) => (
                  <button key={n} type="button" onClick={() => setOpenAt(quick(n))} className={`min-h-10 rounded-full border px-4 text-[13px] ${openAt === quick(n) ? "border-or bg-or text-nuit" : "border-or-pale/35"}`}>
                    {t("dans {n} an(s)", { n })}
                  </button>
                ))}
              </div>
              <div className="rounded-[18px] bg-coton/95 p-4 text-ebene">
                <DateField label={t("Date d’ouverture")} value={openAt} onChange={setOpenAt} future />
              </div>
              {openAt && <p className="mt-3 text-center font-serif text-[20px] text-or-pale">{t("Il s’ouvrira le {date}", { date: formatDate(openAt, lang) })}</p>}
            </>
          )}

          {step === 2 && (
            <>
              <p className="mb-3 text-[13px] text-or-pale">{t("Une lettre, un document scanné, des photos, une note vocale, une vidéo de 45 secondes au plus. Tout est chiffré dans le coffre.")}</p>
              <ItemsEditor items={items} onChange={setItems} />
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={t("Un titre (facultatif) : « Pour tes 18 ans »")} className="mt-5 w-full rounded-[14px] border border-or-pale/25 bg-coton/5 px-4 py-3 text-[15px] text-coton outline-none placeholder:text-or-pale/40 focus:border-or" />
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex justify-center py-2">
                <motion.div animate={{ rotate: [-3, 3, -3] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
                  <CoffreKey code={cc || undefined} size={92} />
                </motion.div>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-or-pale">{t("Choisissez le code gravé sur votre clé : 1 à 4 lettres ou chiffres. La clé restera dans votre profil : avec elle, vous rouvrez le coffre pour y ajouter des choses. Le jour venu, les bénéficiaires recevront cette clé.")}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <input value={code} onChange={(e) => setCode(normCode(e.target.value))} maxLength={4} autoCapitalize="characters" autoComplete="off" placeholder={t("Code")} aria-label={t("Code de la clé")} className="min-h-14 rounded-[14px] border border-or-pale/30 bg-coton/10 text-center font-serif text-[26px] tracking-[6px] text-coton outline-none placeholder:text-[16px] placeholder:tracking-normal placeholder:text-or-pale/40 focus:border-or" />
                <input value={code2} onChange={(e) => setCode2(normCode(e.target.value))} maxLength={4} autoCapitalize="characters" autoComplete="off" placeholder={t("Confirmer")} aria-label={t("Confirmer le code")} className="min-h-14 rounded-[14px] border border-or-pale/30 bg-coton/10 text-center font-serif text-[26px] tracking-[6px] text-coton outline-none placeholder:text-[16px] placeholder:tracking-normal placeholder:text-or-pale/40 focus:border-or" />
              </div>
              {code2 && cc !== normCode(code2) && <p className="mt-2 text-[12px] text-terre">{t("Les deux codes ne sont pas pareils.")}</p>}
              <div className="mt-5 rounded-[16px] border border-or/25 bg-coton/5 p-3 text-[13px] leading-relaxed">
                <p>
                  {t("Pour")} : <span className="text-or">{to.map((x) => (x.kind === "all" ? t(x.label) : x.label)).join(", ")}</span>
                </p>
                <p>
                  {t("Ouverture")} : <span className="text-or">{openAt && formatDate(openAt, lang)}</span>
                </p>
                <p>
                  {t("Contenu")} : <span className="text-or">{t("{n} élément(s)", { n: items.length })}</span>
                </p>
                {read().family && <p className="mt-1 text-[11px] text-coton/55">{t("Personne ne pourra l’ouvrir avant cette date, sauf vous avec votre clé.")}</p>}
              </div>
            </>
          )}
        </motion.section>
      </AnimatePresence>

      {err && <p className="relative mt-4 rounded-[12px] bg-terre/20 px-3 py-2 text-[13px] text-[#F3C9B8]">{err}</p>}
      <div className="relative mt-6 flex gap-2">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className="min-h-12 flex-1 rounded-full border border-or-pale/40 text-[14px] text-or-pale">
            {t("Retour")}
          </button>
        )}
        {step < 3 ? (
          <button type="button" disabled={!ok} onClick={() => setStep(step + 1)} className="min-h-12 flex-[2] rounded-full bg-or text-[15px] font-semibold text-nuit disabled:opacity-40">
            {t("Suivant")}
          </button>
        ) : (
          <button type="button" disabled={!ok || busy} onClick={() => void seal()} className="min-h-12 flex-[2] rounded-full bg-or text-[15px] font-semibold text-nuit shadow-or disabled:opacity-40">
            {busy ? t("Scellement…") : t("Sceller le coffre")}
          </button>
        )}
      </div>
    </main>
  );
}
