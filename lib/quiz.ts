import type { T } from "./i18n/core";
import { computeGenerations } from "./genealogy";
import { fullName, type Parentage, type Person, type Union } from "./types";

// Quiz de la famille : des questions fabriquées à partir de l'arbre et des fiches.
// Chaque question a 4 réponses (ou moins si la famille est petite) et une explication.

export interface QuizOption {
  id: string;
  label: string;
  photoId?: string;
}
export interface QuizQuestion {
  id: string;
  prompt: string;
  personId?: string;
  photoId?: string;
  options: QuizOption[];
  answer: string;
  explain: string;
}

export interface QuizData {
  persons: Person[];
  parentages: Parentage[];
  unions: Union[];
}

const VILLAGES = ["Sakassou", "Toumodi", "Béoumi", "Bouaké", "Dimbokro", "Tiébissou", "Daloa", "Korhogo", "Man", "Bondoukou", "Agboville", "Divo"];
const JOBS = ["Planteur", "Instituteur", "Commerçante", "Couturière", "Mécanicien", "Sage-femme", "Chauffeur", "Infirmier", "Pêcheur", "Menuisier"];
const DISHES = ["Foutou banane", "Attiéké poisson", "Kédjénou", "Garba", "Alloco", "Placali", "Sauce graine", "Riz gras", "Foufou", "Sauce arachide"];
const DAYS = ["né un lundi", "né un mardi", "né un mercredi", "né un jeudi", "né un vendredi", "né un samedi", "né un dimanche"];

function shuffle<A>(a: A[]): A[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Une bonne réponse et des leurres différents, mélangés. */
function choices(correct: string, pool: string[], n = 4): QuizOption[] {
  const others = shuffle([...new Set(pool.filter((x) => x && x.toLowerCase() !== correct.toLowerCase()))]).slice(0, n - 1);
  return shuffle([correct, ...others]).map((label) => ({ id: label, label }));
}

function personChoices(correct: Person, pool: Person[], n = 4): QuizOption[] {
  const others = shuffle(pool.filter((p) => p.id !== correct.id)).slice(0, n - 1);
  return shuffle([correct, ...others]).map((p) => ({ id: p.id, label: fullName(p), photoId: p.photoId }));
}

export function buildQuiz(d: QuizData, t: T, count = 10): QuizQuestion[] {
  const people = d.persons.filter((p) => !p.placeholder);
  if (people.length < 3) return [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const parentsOf = (id: string) => (d.parentages.find((x) => x.childId === id)?.parentIds ?? []).map((x) => byId.get(x)).filter(Boolean) as Person[];
  const childrenOf = (id: string) => d.parentages.filter((x) => x.parentIds.includes(id)).map((x) => byId.get(x.childId)).filter(Boolean) as Person[];
  const spousesOf = (id: string) => d.unions.filter((u) => u.partnerA === id || u.partnerB === id).map((u) => byId.get(u.partnerA === id ? u.partnerB : u.partnerA)).filter(Boolean) as Person[];
  const gens = computeGenerations(d.persons, d.parentages, d.unions);
  const qs: QuizQuestion[] = [];
  const add = (q: Omit<QuizQuestion, "id">) => q.options.length >= 2 && qs.push({ ...q, id: `q${qs.length}` });

  for (const p of shuffle(people)) {
    const name = p.givenName;
    const f = p.sex === "f";
    // Parents
    for (const par of parentsOf(p.id)) {
      const pool = people.filter((x) => x.sex === par.sex && x.id !== p.id);
      add({
        prompt: par.sex === "f" ? t("Qui est la mère de {p} ?", { p: name }) : t("Qui est le père de {p} ?", { p: name }),
        personId: p.id,
        photoId: p.photoId,
        options: personChoices(par, pool),
        answer: par.id,
        explain: par.sex === "f" ? t("{a} est la mère de {p}.", { a: fullName(par), p: name }) : t("{a} est le père de {p}.", { a: fullName(par), p: name }),
      });
    }
    // Conjoint
    const sp = spousesOf(p.id)[0];
    if (sp) {
      add({
        prompt: f ? t("Qui est l’époux de {p} ?", { p: name }) : t("Qui est l’épouse de {p} ?", { p: name }),
        personId: p.id,
        photoId: p.photoId,
        options: personChoices(sp, people.filter((x) => x.sex === sp.sex && x.id !== p.id)),
        answer: sp.id,
        explain: t("{a} et {p} sont unis.", { a: fullName(sp), p: name }),
      });
    }
    // Année de naissance
    if (p.birthYear) {
      const y = p.birthYear;
      const pool = shuffle([-12, -7, -4, -2, 3, 5, 9, 14]).slice(0, 3).map((k) => String(y + k));
      add({
        prompt: f ? t("En quelle année est née {p} ?", { p: name }) : t("En quelle année est né {p} ?", { p: name }),
        personId: p.id,
        photoId: p.photoId,
        options: choices(String(y), pool),
        answer: String(y),
        explain: f ? t("{p} est née en {y}.", { p: fullName(p), y }) : t("{p} est né en {y}.", { p: fullName(p), y }),
      });
    }
    // Village
    if (p.village) {
      add({
        prompt: t("De quel village vient {p} ?", { p: name }),
        personId: p.id,
        photoId: p.photoId,
        options: choices(p.village, [...people.map((x) => x.village ?? ""), ...VILLAGES]),
        answer: p.village,
        explain: t("{p} vient de {v}.", { p: fullName(p), v: p.village }),
      });
    }
    // Métier
    if (p.job) {
      add({
        prompt: p.isLiving ? t("Quel est le métier de {p} ?", { p: name }) : t("Quel était le métier de {p} ?", { p: name }),
        personId: p.id,
        photoId: p.photoId,
        options: choices(p.job, [...people.map((x) => x.job ?? ""), ...JOBS]),
        answer: p.job,
        explain: t("{p} : {j}.", { p: fullName(p), j: p.job }),
      });
    }
    // Plat favori
    const dish = p.favoriteDishes?.[0];
    if (dish) {
      const all = p.favoriteDishes!;
      add({
        prompt: t("Quel est le plat favori de {p} ?", { p: name }),
        personId: p.id,
        photoId: p.photoId,
        options: choices(dish, [...people.flatMap((x) => x.favoriteDishes ?? []), ...DISHES].filter((x) => !all.includes(x))),
        answer: dish,
        explain: t("{p} aime : {liste}.", { p: fullName(p), liste: all.join(", ") }),
      });
    }
    // Nom de jour
    if (p.dayName && p.dayNameMeaning) {
      add({
        prompt: t("Que veut dire le nom de jour « {d} » de {p} ?", { d: p.dayName, p: name }),
        personId: p.id,
        photoId: p.photoId,
        options: choices(p.dayNameMeaning, [...people.map((x) => x.dayNameMeaning ?? ""), ...DAYS]),
        answer: p.dayNameMeaning,
        explain: t("« {d} » : {m}.", { d: p.dayName, m: p.dayNameMeaning }),
      });
    }
    // Citation
    if (p.quote) {
      add({
        prompt: t("Qui disait souvent : « {c} » ?", { c: p.quote }),
        options: personChoices(p, people),
        answer: p.id,
        explain: t("C’était une phrase de {p}.", { p: fullName(p) }),
      });
    }
    // Nombre d'enfants
    const kids = childrenOf(p.id);
    if (kids.length >= 2) {
      const n = kids.length;
      add({
        prompt: t("Combien d’enfants de {p} sont dans l’arbre ?", { p: name }),
        personId: p.id,
        photoId: p.photoId,
        options: choices(String(n), [n - 1, n + 1, n + 2, n + 3].filter((x) => x > 0).map(String)),
        answer: String(n),
        explain: t("Enfants de {p} : {liste}.", { p: name, liste: kids.map((k) => k.givenName).join(", ") }),
      });
    }
    // Génération
    const g = gens.get(p.id);
    if (g && people.length >= 5 && Math.random() < 0.3) {
      const R = ["I", "II", "III", "IV", "V", "VI"];
      add({
        prompt: t("À quelle génération appartient {p} ?", { p: name }),
        personId: p.id,
        photoId: p.photoId,
        options: choices(R[g - 1] ?? String(g), R.slice(0, Math.max(4, g + 1))),
        answer: R[g - 1] ?? String(g),
        explain: t("{p} est de la génération {g}.", { p: fullName(p), g: R[g - 1] ?? g }),
      });
    }
  }

  // Le doyen
  const living = people.filter((p) => p.isLiving && p.birthYear).sort((a, b) => a.birthYear! - b.birthYear!);
  if (living.length >= 3) {
    add({
      prompt: t("Qui est la personne la plus âgée encore en vie ?"),
      options: personChoices(living[0], living),
      answer: living[0].id,
      explain: t("{p}, né(e) en {y}.", { p: fullName(living[0]), y: living[0].birthYear! }),
    });
  }

  // On varie : jamais deux fois la même personne d'affilée quand c'est possible.
  const picked: QuizQuestion[] = [];
  const pool = shuffle(qs);
  while (picked.length < count && pool.length) {
    const last = picked[picked.length - 1]?.personId;
    const k = pool.findIndex((q) => !q.personId || q.personId !== last);
    picked.push(pool.splice(k < 0 ? 0 : k, 1)[0]);
  }
  return picked;
}
