"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/core";
import { askConfirm } from "@/components/Confirm";
import { sound } from "@/lib/sound";
import type { ParentageKind, Person, UnionKind } from "@/lib/types";
import { Area, ErrorNote, Field, GhostButton, PageHeader, PrimaryButton, Select, Toggle } from "../ui";
import { PhotosPicker } from "./PhotosPicker";

export type Relation =
  | "pere" | "mere" | "frere" | "soeur" | "demifrere" | "demisoeur" | "fils" | "fille" | "epoux" | "epouse"
  | "grandpere" | "grandmere" | "oncle" | "tante" | "cousin" | "cousine" | "neveu" | "niece" | "petitfils" | "petitefille";

export interface KinChoices {
  parents: { id: string; name: string; sex: "m" | "f" }[];
  siblings: { id: string; name: string }[];
  children: { id: string; name: string }[];
  unclesM: { id: string; name: string }[];
  unclesF: { id: string; name: string }[];
}

export interface PersonOption {
  id: string;
  name: string;
  sex: "f" | "m";
  birthYear?: number;
  photoId?: string;
}

interface Props {
  person?: Person;
  options: PersonOption[]; // les autres personnes de l'arbre
  initial: { parents: string[]; parentKind: ParentageKind; spouses: { id: string; kind: UnionKind; rank?: number }[]; children: string[] };
  backHref: string;
  /** Nom de famille proposé pour une nouvelle fiche. */
  defaultFamilyName?: string;
  /** La fiche créée est celle de l'utilisateur lui-même. */
  isMe?: boolean;
  /** Ajout par lien de parenté : personne de référence et lien proposé. */
  anchor?: { id: string; relation?: Relation; choices: Record<string, KinChoices> };
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-or-pale/70 bg-white/70 shadow-doux">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3.5 text-left">
        <span className="font-serif text-lg text-nuit">{title}</span>
        <motion.svg animate={{ rotate: open ? 180 : 0 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A6A2E" strokeWidth="2" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}>
            <div className="flex flex-col gap-4 px-4 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function PersonForm({ person, options, initial, backHref, defaultFamilyName, isMe, anchor }: Props) {
  const t = useT();
  const router = useRouter();
  const p = person;
  const [f, setF] = useState({
    givenName: p?.placeholder ? "" : p?.givenName ?? "",
    familyName: p?.familyName ?? defaultFamilyName ?? "",
    nickname: p?.nickname ?? "",
    sex: p?.sex ?? "m",
    isLiving: p?.isLiving ?? true,
    birthYear: p?.birthYear?.toString() ?? "",
    deathYear: p?.deathYear?.toString() ?? "",
    birthDate: p?.birthDate ?? "",
    deathDate: p?.deathDate ?? "",
    village: p?.village ?? "",
    city: p?.city ?? "",
    job: p?.job ?? "",
    ethnicity: p?.ethnicity ?? "",
    clan: p?.clan ?? "",
    dayName: p?.dayName ?? "",
    dayNameMeaning: p?.dayNameMeaning ?? "",
    bio: p?.bio ?? "",
    quote: p?.quote ?? "",
    visibility: p?.visibility ?? "famille",
  });
  const [photos, setPhotos] = useState<string[]>(p?.photoIds ?? (p?.photoId ? [p.photoId] : []));
  // Lien de parenté (nouvelle personne) : « [lien] de [personne] ».
  const [kin, setKin] = useState<{ anchorId: string; relation: Relation | ""; side: "m" | "f"; viaId: string }>({
    anchorId: anchor?.id ?? "",
    relation: anchor?.relation ?? "",
    side: "m",
    viaId: "",
  });
  const [parents, setParents] = useState<string[]>(initial.parents);
  const [parentKind, setParentKind] = useState<ParentageKind>(initial.parentKind);
  const [spouses, setSpouses] = useState(initial.spouses);
  const [children] = useState(initial.children);
  const [timeline, setTimeline] = useState(p?.timeline ?? []);
  const [dishes, setDishes] = useState<string[]>(p?.favoriteDishes ?? []);
  const [animated, setAnimated] = useState(p?.animatePortrait ?? true);
  const [open, setOpen] = useState<Record<string, boolean>>({ id: true, liens: !p, origines: false, histoire: false, frise: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const toggle = (k: string) => () => setOpen({ ...open, [k]: !open[k] });
  const others = options.filter((o) => o.id !== p?.id);
  const label = (o: PersonOption) => `${o.name}${o.birthYear ? ` (${o.birthYear})` : ""}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.givenName.trim()) {
      setError(t("Le prénom est obligatoire."));
      setOpen({ ...open, id: true });
      return;
    }
    setBusy(true);
    setError(null);
    const byKin = !p && kin.relation && kin.anchorId;
    const payload = {
      ...f,
      isLiving: f.isLiving && !f.deathYear && !f.deathDate,
      photoIds: photos,
      ...(byKin
        ? { relation: kin.relation, anchorId: kin.anchorId, side: kin.side, viaId: kin.viaId || undefined }
        : { parents: parents.filter(Boolean), parentKind, spouses: spouses.filter((s) => s.id), children }),
      timeline: timeline.filter((x) => x.text.trim()),
      favoriteDishes: dishes,
      animatePortrait: animated,
      ...(isMe && !p ? { isMe: true } : {}),
    };
    try {
      const r = p ? await api<{ id: string }>(`/api/personnes/${p.id}`, "PATCH", payload) : await api<{ id: string }>("/api/personnes", "POST", payload);
      sound.play("success");
      router.replace(byKin ? `/arbre?p=${r.id}` : `/membre/${r.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!p) return;
    if (!(await askConfirm(t("Supprimer {nom} de l’arbre ? Ses liens familiaux seront retirés. Cette action est définitive.", { nom: p.givenName })))) return;
    setBusy(true);
    try {
      await api(`/api/personnes/${p.id}`, "DELETE");
      router.replace("/arbre");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-kapok pb-10">
      <PageHeader back={backHref} kicker={p ? t("modifier la fiche") : t("nouvelle personne")} title={p ? `${p.givenName} ${p.familyName}`.trim() : t("Ajouter une personne")} />
      <form onSubmit={save} className="flex flex-col gap-3 px-4">
        {!p && others.length > 0 && <KinSection kin={kin} setKin={setKin} options={others} choices={anchor?.choices ?? {}} />}
        <Section title={t("Identité")} open={open.id} onToggle={toggle("id")}>
          <PhotosPicker value={photos} onChange={setPhotos} isPublic={f.visibility === "public"} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Prénom *")} value={f.givenName} onChange={set("givenName")} maxLength={60} />
            <Field label={t("Nom de famille")} value={f.familyName} onChange={set("familyName")} maxLength={60} />
          </div>
          <Field label={t("Surnom ou titre")} placeholder={t("Ex. Papa Yao, Tantie Ahou, Nanan")} value={f.nickname} onChange={set("nickname")} maxLength={60} />
          {!(!p && kin.relation) && <div className="flex gap-2" role="group" aria-label={t("Sexe")}>
            {(["m", "f"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setF({ ...f, sex: v })} aria-pressed={f.sex === v} className={`min-h-11 flex-1 rounded-full border text-sm ${f.sex === v ? "border-foret bg-foret text-coton" : "border-or-pale text-foret"}`}>
                {v === "m" ? t("Homme") : t("Femme")}
              </button>
            ))}
          </div>}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Année de naissance")} inputMode="numeric" value={f.birthYear} onChange={set("birthYear")} placeholder="1950" />
            <Field label={t("Année de décès")} inputMode="numeric" value={f.deathYear} onChange={set("deathYear")} placeholder={t("si décédé(e)")} />
          </div>
          <Toggle label={t("En vie")} checked={f.isLiving && !f.deathYear && !f.deathDate} onChange={(v) => setF({ ...f, isLiving: v, deathYear: v ? "" : f.deathYear, deathDate: v ? "" : f.deathDate })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Date de naissance")} type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value, birthYear: e.target.value ? e.target.value.slice(0, 4) : f.birthYear })} />
            {!(f.isLiving && !f.deathYear) && (
              <Field label={t("Date du décès")} type="date" value={f.deathDate} onChange={(e) => setF({ ...f, deathDate: e.target.value, deathYear: e.target.value ? e.target.value.slice(0, 4) : f.deathYear })} />
            )}
          </div>
          <p className="-mt-2 text-xs text-[#6B6455]">{t("Facultatif : la date exacte permet de marquer les anniversaires.")}</p>
          {!(f.isLiving && !f.deathYear && !f.deathDate) && (
            <Toggle
              label={t("Portrait animé")}
              hint={t("Son visage prend vie doucement : respiration lente, lumière chaude, léger mouvement.")}
              checked={animated}
              onChange={setAnimated}
            />
          )}
        </Section>

        {!(!p && kin.relation) && <Section title={t("Liens familiaux")} open={open.liens} onToggle={toggle("liens")}>
          {others.length === 0 ? (
            <p className="text-sm text-[#6B6455]">{t("C’est la première personne de l’arbre. Les liens pourront être ajoutés avec les personnes suivantes.")}</p>
          ) : (
            <>
              {[0, 1].map((i) => (
                <Select key={i} label={i === 0 ? t("Parent 1") : t("Parent 2")} value={parents[i] ?? ""} onChange={(e) => { const n = [parents[0] ?? "", parents[1] ?? ""]; n[i] = e.target.value; setParents(n); }}>
                  <option value="">{t("— Aucun —")}</option>
                  {others.filter((o) => !parents.includes(o.id) || parents[i] === o.id).map((o) => (
                    <option key={o.id} value={o.id}>{label(o)}</option>
                  ))}
                </Select>
              ))}
              {parents.some(Boolean) && (
                <Select label={t("Type de filiation")} value={parentKind} onChange={(e) => setParentKind(e.target.value as ParentageKind)}>
                  <option value="biological">{t("Biologique")}</option>
                  <option value="adoptive">{t("Adoption")}</option>
                  <option value="fostered">{t("Enfant confié (élevé par eux)")}</option>
                  <option value="guardianship">{t("Tutelle")}</option>
                </Select>
              )}

              <div className="mt-1 border-t border-or-pale/60 pt-4">
                <p className="mb-2 text-[13px] font-medium text-foret">{t("Conjoint(s)")}</p>
                <AnimatePresence initial={false}>
                  {spouses.map((sp, i) => (
                    <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-3 grid grid-cols-[1fr_auto] gap-2 rounded-[14px] bg-coton p-3">
                      <Select label={t("Conjoint")} value={sp.id} onChange={(e) => setSpouses(spouses.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))}>
                        <option value="">{t("— Choisir —")}</option>
                        {others.map((o) => (
                          <option key={o.id} value={o.id}>{label(o)}</option>
                        ))}
                      </Select>
                      <button type="button" onClick={() => setSpouses(spouses.filter((_, j) => j !== i))} aria-label={t("Retirer ce conjoint")} className="mt-6 flex h-11 w-11 items-center justify-center rounded-full text-[#8A3A26]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                      <Select label={t("Union")} value={sp.kind} onChange={(e) => setSpouses(spouses.map((x, j) => (j === i ? { ...x, kind: e.target.value as UnionKind } : x)))}>
                        <option value="customary">{t("Coutumière")}</option>
                        <option value="civil">{t("Civile")}</option>
                        <option value="religious">{t("Religieuse")}</option>
                      </Select>
                      <Select label={t("Rang")} value={sp.rank?.toString() ?? ""} onChange={(e) => setSpouses(spouses.map((x, j) => (j === i ? { ...x, rank: e.target.value ? Number(e.target.value) : undefined } : x)))}>
                        <option value="">—</option>
                        {[1, 2, 3, 4].map((r) => (
                          <option key={r} value={r}>{r === 1 ? t("1re") : t("{n}e", { n: r })}</option>
                        ))}
                      </Select>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <GhostButton type="button" onClick={() => setSpouses([...spouses, { id: "", kind: "customary" }])} className="w-full">
                  {t("+ Ajouter un conjoint")}
                </GhostButton>
              </div>
            </>
          )}
        </Section>}

        <Section title={t("Origines et culture")} open={open.origines} onToggle={toggle("origines")}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Village d’origine")} value={f.village} onChange={set("village")} maxLength={80} />
            <Field label={t("Ville actuelle")} value={f.city} onChange={set("city")} maxLength={80} />
          </div>
          <Field label={t("Métier")} value={f.job} onChange={set("job")} maxLength={80} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Ethnie")} value={f.ethnicity} onChange={set("ethnicity")} maxLength={60} />
            <Field label={t("Clan / lignage")} value={f.clan} onChange={set("clan")} maxLength={60} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Nom traditionnel")} placeholder={t("Ex. Kouassi")} value={f.dayName} onChange={set("dayName")} maxLength={40} />
            <Field label={t("Sa signification")} placeholder={t("Ex. né un dimanche")} value={f.dayNameMeaning} onChange={set("dayNameMeaning")} maxLength={80} />
          </div>
        </Section>

        <Section title={t("Son histoire")} open={open.histoire} onToggle={toggle("histoire")}>
          <Area label={t("Biographie")} value={f.bio} onChange={set("bio")} maxLength={4000} placeholder={t("Son enfance, son métier, ce qui le/la rendait unique…")} />
          <Field label={t("Citation favorite")} value={f.quote} onChange={set("quote")} maxLength={240} placeholder={t("Une phrase qu’il/elle répétait souvent")} />
          <DishesInput value={dishes} onChange={setDishes} />
        </Section>

        <Section title={t("Frise de vie")} open={open.frise} onToggle={toggle("frise")}>
          <AnimatePresence initial={false}>
            {timeline.map((ev, i) => (
              <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-[84px_1fr_auto] items-end gap-2">
                <Field label={t("Année")} inputMode="numeric" value={ev.year ? String(ev.year) : ""} onChange={(e) => setTimeline(timeline.map((x, j) => (j === i ? { ...x, year: Number(e.target.value) || 0 } : x)))} />
                <Field label={t("Événement")} value={ev.text} onChange={(e) => setTimeline(timeline.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} maxLength={200} />
                <button type="button" onClick={() => setTimeline(timeline.filter((_, j) => j !== i))} aria-label={t("Retirer cet événement")} className="mb-1 flex h-11 w-11 items-center justify-center text-[#8A3A26]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <GhostButton type="button" onClick={() => setTimeline([...timeline, { year: 0, text: "" }])}>
            {t("+ Ajouter un événement")}
          </GhostButton>
        </Section>

        <section className="rounded-[20px] border border-or-pale/70 bg-white/70 px-4 py-2 shadow-doux">
          <Toggle
            label={t("Fiche publique")}
            hint={t("Visible par toute personne qui scanne son QR code, sans compte. Sinon, réservée à la famille.")}
            checked={f.visibility === "public"}
            onChange={(v) => setF({ ...f, visibility: v ? "public" : "famille" })}
          />
        </section>

        <ErrorNote message={error} />
        <PrimaryButton type="submit" loading={busy} className="mt-2">
          {p ? t("Enregistrer les modifications") : t("Ajouter à l’arbre")}
        </PrimaryButton>
        {p && (
          <button type="button" onClick={remove} disabled={busy} className="mt-1 min-h-12 text-sm text-[#8A3A26]">
            {t("Supprimer cette personne")}
          </button>
        )}
      </form>
    </main>
  );
}

const REL_GROUPS: { title: string; items: Relation[] }[] = [
  { title: tx("Parents"), items: ["pere", "mere"] },
  { title: tx("Frères et sœurs"), items: ["frere", "soeur", "demifrere", "demisoeur"] },
  { title: tx("Couple et enfants"), items: ["epoux", "epouse", "fils", "fille"] },
  { title: tx("Grands-parents"), items: ["grandpere", "grandmere"] },
  { title: tx("Oncles, tantes, cousins"), items: ["oncle", "tante", "cousin", "cousine"] },
  { title: tx("Neveux et petits-enfants"), items: ["neveu", "niece", "petitfils", "petitefille"] },
];

export const REL_LABEL: Record<Relation, string> = {
  pere: tx("Père"), mere: tx("Mère"), frere: tx("Frère"), soeur: tx("Sœur"), demifrere: tx("Demi-frère"), demisoeur: tx("Demi-sœur"), fils: tx("Fils"), fille: tx("Fille"), epoux: tx("Époux"), epouse: tx("Épouse"),
  grandpere: tx("Grand-père"), grandmere: tx("Grand-mère"), oncle: tx("Oncle"), tante: tx("Tante"), cousin: tx("Cousin"), cousine: tx("Cousine"), neveu: tx("Neveu"), niece: tx("Nièce"), petitfils: tx("Petit-fils"), petitefille: tx("Petite-fille"),
};

type Kin = { anchorId: string; relation: Relation | ""; side: "m" | "f"; viaId: string };

function KinSection({ kin, setKin, options, choices }: { kin: Kin; setKin: (k: Kin) => void; options: PersonOption[]; choices: Record<string, KinChoices> }) {
  const t = useT();
  const c = choices[kin.anchorId];
  const anchorName = options.find((o) => o.id === kin.anchorId)?.name.split(" ")[0] ?? "";
  const needsSide = ["demifrere", "demisoeur", "grandpere", "grandmere", "oncle", "tante", "cousin", "cousine"].includes(kin.relation);
  // Qui relie la nouvelle personne : l'oncle (cousins), le frère (neveux), l'enfant (petits-enfants).
  const via =
    kin.relation === "cousin" || kin.relation === "cousine"
      ? { label: t("Enfant de quel oncle ou tante ?"), list: (kin.side === "m" ? c?.unclesM : c?.unclesF) ?? [] }
      : kin.relation === "neveu" || kin.relation === "niece"
        ? { label: t("Enfant de quel frère ou sœur ?"), list: c?.siblings ?? [] }
        : kin.relation === "petitfils" || kin.relation === "petitefille"
          ? { label: t("Enfant de quel enfant ?"), list: c?.children ?? [] }
          : null;
  return (
    <section className="rounded-[20px] border border-or bg-white/80 p-4 shadow-doux">
      <h2 className="font-serif text-lg text-nuit">{t("Lien de parenté")}</h2>
      <p className="mb-3 text-[13px] leading-snug text-[#6B6455]">{t("Dites qui est cette personne : l’arbre se range tout seul.")}</p>
      <Select label={t("Par rapport à")} value={kin.anchorId} onChange={(e) => setKin({ ...kin, anchorId: e.target.value, viaId: "" })}>
        <option value="">{t("— Choisir —")}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </Select>
      {kin.anchorId && (
        <div className="mt-3 space-y-3">
          {REL_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-1.5 text-[11px] uppercase tracking-[1.2px] text-or-fonce">{t(g.title)}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setKin({ ...kin, relation: kin.relation === r ? "" : r, viaId: "" })}
                    aria-pressed={kin.relation === r}
                    className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${kin.relation === r ? "border-foret bg-foret text-coton" : "border-or-pale bg-coton text-foret"}`}
                  >
                    {t(REL_LABEL[r])}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {kin.relation && (
            <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-[12px] bg-kapok px-3 py-2 font-main text-[19px] text-foret">
              {t("{lien} de {nom}", { lien: t(REL_LABEL[kin.relation]), nom: anchorName })}
            </motion.p>
          )}
          {needsSide && (
            <div className="flex gap-2" role="group" aria-label={t("Côté")}>
              {(["m", "f"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setKin({ ...kin, side: v, viaId: "" })} aria-pressed={kin.side === v} className={`min-h-11 flex-1 rounded-full border text-[13px] ${kin.side === v ? "border-foret bg-foret text-coton" : "border-or-pale text-foret"}`}>
                  {v === "m" ? t("Côté du père") : t("Côté de la mère")}
                </button>
              ))}
            </div>
          )}
          {via && via.list.length > 1 && (
            <Select label={via.label} value={kin.viaId} onChange={(e) => setKin({ ...kin, viaId: e.target.value })}>
              <option value="">{t("— Choisir —")}</option>
              {via.list.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
              <option value="new">{t("Une autre personne (à compléter)")}</option>
            </Select>
          )}
          {via && via.list.length === 0 && <p className="text-xs text-[#6B6455]">{t("Le lien manquant sera ajouté dans l’arbre comme case « à compléter ».")}</p>}
          {!kin.relation && <p className="text-xs text-[#6B6455]">{t("Ou laissez vide et réglez les parents et conjoints vous-même plus bas.")}</p>}
        </div>
      )}
    </section>
  );
}

const DISH_IDEAS = ["Foutou banane", "Attiéké poisson", "Kédjénou", "Garba", "Alloco", "Placali", "Sauce graine", "Sauce arachide", "Riz gras", "Foufou", "Gouagouassou", "Sauce feuille"];

/** Plats favoris : on tape et on valide, ou on touche une suggestion. */
function DishesInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const add = (d: string) => {
    const x = d.trim();
    if (!x || value.some((v) => v.toLowerCase() === x.toLowerCase()) || value.length >= 5) return;
    onChange([...value, x]);
    setDraft("");
  };
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-foret">{t("Plats favoris")}</span>
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence initial={false}>
          {value.map((d) => (
            <motion.button
              key={d}
              type="button"
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => onChange(value.filter((x) => x !== d))}
              className="flex items-center gap-1.5 rounded-full bg-terre/90 px-3 py-1.5 text-[13px] text-coton"
              aria-label={t("Retirer {x}", { x: d })}
            >
              {d}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
      {value.length < 5 && (
        <div className="mt-2 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
            maxLength={60}
            placeholder={t("Ex. Foutou banane sauce graine")}
            className="min-w-0 flex-1 rounded-[14px] border border-or-pale bg-coton px-3.5 py-3 text-[15px] outline-none focus:border-or"
          />
          <button type="button" onClick={() => add(draft)} className="rounded-full bg-foret px-4 text-sm text-coton">{t("Ajouter")}</button>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {DISH_IDEAS.filter((d) => !value.includes(d)).slice(0, 8).map((d) => (
          <button key={d} type="button" onClick={() => add(d)} className="rounded-full border border-dashed border-or px-2.5 py-1 text-[12px] text-or-fonce">
            + {d}
          </button>
        ))}
      </div>
    </div>
  );
}
