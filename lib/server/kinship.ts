import type { Person, Store } from "../types";
import { newId, shortCode } from "./store";

// Ajout d'un proche par son lien de parenté (« la tante de Kouadio, côté père »).
// On crée les liens nécessaires dans l'arbre ; quand un maillon manque
// (le père d'un cousin, par exemple), on crée une case « à compléter ».

export const RELATIONS = [
  "pere", "mere", "frere", "soeur", "demifrere", "demisoeur", "fils", "fille", "epoux", "epouse",
  "grandpere", "grandmere", "oncle", "tante", "cousin", "cousine", "neveu", "niece", "petitfils", "petitefille",
] as const;
export type Relation = (typeof RELATIONS)[number];

/** Sexe imposé par le lien. */
export const RELATION_SEX: Record<Relation, "m" | "f"> = {
  pere: "m", mere: "f", frere: "m", soeur: "f", demifrere: "m", demisoeur: "f", fils: "m", fille: "f", epoux: "m", epouse: "f",
  grandpere: "m", grandmere: "f", oncle: "m", tante: "f", cousin: "m", cousine: "f", neveu: "m", niece: "f", petitfils: "m", petitefille: "f",
};

export class KinError extends Error {}

const parentsOf = (s: Store, id: string) => s.parentages.find((p) => p.childId === id)?.parentIds ?? [];
const person = (s: Store, id: string) => s.persons.find((p) => p.id === id);
const childrenOf = (s: Store, id: string) => s.parentages.filter((p) => p.parentIds.includes(id)).map((p) => p.childId);
const spousesOf = (s: Store, id: string) => s.unions.filter((u) => u.partnerA === id || u.partnerB === id).map((u) => (u.partnerA === id ? u.partnerB : u.partnerA));

function makePerson(s: Store, x: Partial<Person> & Pick<Person, "givenName" | "sex">): Person {
  const p: Person = {
    id: newId(),
    familyName: "",
    isLiving: true,
    qrCode: shortCode(4, new Set(s.persons.map((q) => q.qrCode))),
    visibility: s.settings.defaultVisibility,
    timeline: [],
    createdAt: Date.now(),
    ...x,
  };
  s.persons.push(p);
  return p;
}

function placeholder(s: Store, label: string, sex: "m" | "f", familyName = "") {
  return makePerson(s, { givenName: label, familyName, sex, placeholder: true, isLiving: true });
}

function addUnion(s: Store, a: string, b: string) {
  if (a === b || s.unions.some((u) => (u.partnerA === a && u.partnerB === b) || (u.partnerA === b && u.partnerB === a))) return;
  s.unions.push({ id: newId(), partnerA: a, partnerB: b, kind: "customary" });
}

function addParent(s: Store, childId: string, parentId: string) {
  const pa = s.parentages.find((p) => p.childId === childId);
  if (!pa) s.parentages.push({ childId, parentIds: [parentId], kind: "biological" });
  else if (!pa.parentIds.includes(parentId)) {
    if (pa.parentIds.length >= 2) throw new KinError("Cette personne a déjà deux parents dans l’arbre.");
    pa.parentIds.push(parentId);
  }
  // Les deux parents d'un enfant forment un foyer.
  const ps = parentsOf(s, childId);
  if (ps.length === 2) addUnion(s, ps[0], ps[1]);
}

/** Le parent de ce sexe ; créé « à compléter » s'il manque. */
function ensureParent(s: Store, childId: string, sex: "m" | "f"): string {
  const found = parentsOf(s, childId).find((id) => person(s, id)?.sex === sex);
  if (found) return found;
  const c = person(s, childId)!;
  const label = sex === "m" ? `Père de ${c.givenName}` : `Mère de ${c.givenName}`;
  const ph = placeholder(s, label, sex, sex === "m" ? c.familyName : "");
  addParent(s, childId, ph.id);
  return ph.id;
}

/** Remplit une case « à compléter » au lieu d'en créer une nouvelle. */
function fillOrCreate(s: Store, existing: string | undefined, fields: Partial<Person> & Pick<Person, "givenName" | "sex">): Person {
  const ph = existing ? person(s, existing) : undefined;
  if (ph?.placeholder) {
    Object.assign(ph, fields);
    delete ph.placeholder;
    return ph;
  }
  return makePerson(s, fields);
}

export function addRelative(
  s: Store,
  anchorId: string,
  relation: Relation,
  fields: Partial<Person> & Pick<Person, "givenName">,
  opts: { side?: "m" | "f"; viaId?: string; otherParentId?: string } = {},
): string {
  const a = person(s, anchorId);
  if (!a) throw new KinError("Personne introuvable");
  const sex = RELATION_SEX[relation];
  const f = { ...fields, sex };
  const side = opts.side ?? "m";

  const asParentOf = (childId: string) => {
    const same = parentsOf(s, childId).find((id) => person(s, id)?.sex === sex);
    if (same && !person(s, same)?.placeholder) {
      const c = person(s, childId)!;
      throw new KinError(sex === "m" ? `${c.givenName} a déjà un père dans l’arbre.` : `${c.givenName} a déjà une mère dans l’arbre.`);
    }
    const p = fillOrCreate(s, same, f);
    if (!same) addParent(s, childId, p.id);
    return p.id;
  };

  // « L'autre parent » choisi dans le formulaire : une personne de l'arbre, ou « none » (inconnu).
  const other = opts.otherParentId && opts.otherParentId !== "none" && person(s, opts.otherParentId) ? opts.otherParentId : undefined;
  const asSiblingOf = (sibId: string, onlySide?: "m" | "f") => {
    let ps = parentsOf(s, sibId);
    if (onlySide) ps = [ensureParent(s, sibId, onlySide), ...(other ? [other] : [])];
    else if (!ps.length) ps = [ensureParent(s, sibId, "m"), ensureParent(s, sibId, "f")];
    const p = makePerson(s, f);
    s.parentages.push({ childId: p.id, parentIds: [...ps], kind: "biological" });
    return p.id;
  };

  const asChildOf = (parentId: string, chosen?: string) => {
    const p = makePerson(s, f);
    const sp = spousesOf(s, parentId);
    const second = chosen ? (chosen === "none" ? undefined : chosen) : sp.length === 1 ? sp[0] : undefined;
    s.parentages.push({ childId: p.id, parentIds: second && second !== parentId ? [parentId, second] : [parentId], kind: "biological" });
    return p.id;
  };

  const pick = (candidates: string[], label: () => string, makeSex: "m" | "f", make: (ph: Person) => void) => {
    if (opts.viaId && candidates.includes(opts.viaId)) return opts.viaId;
    if (candidates.length === 1 && !opts.viaId) return candidates[0];
    const ph = placeholder(s, label(), makeSex);
    make(ph);
    return ph.id;
  };

  switch (relation) {
    case "pere":
    case "mere":
      return asParentOf(a.id);
    case "frere":
    case "soeur":
      return asSiblingOf(a.id);
    case "demifrere":
    case "demisoeur":
      return asSiblingOf(a.id, side);
    case "fils":
    case "fille":
      return asChildOf(a.id, opts.otherParentId);
    case "epoux":
    case "epouse": {
      const p = makePerson(s, f);
      const rank = s.unions.filter((u) => u.partnerA === a.id || u.partnerB === a.id).length + 1;
      s.unions.push({ id: newId(), partnerA: a.id, partnerB: p.id, kind: "customary", rank: rank > 1 || relation === "epouse" ? rank : undefined });
      return p.id;
    }
    case "grandpere":
    case "grandmere":
      return asParentOf(ensureParent(s, a.id, side));
    case "oncle":
    case "tante":
      return asSiblingOf(ensureParent(s, a.id, side));
    case "cousin":
    case "cousine": {
      const parent = ensureParent(s, a.id, side);
      const gp = parentsOf(s, parent);
      const uncles = gp.length ? s.parentages.filter((p) => p.childId !== parent && p.parentIds.some((x) => gp.includes(x))).map((p) => p.childId) : [];
      const via = pick(uncles, () => `Oncle ou tante de ${a.givenName}`, "m", (ph) => {
        const g = parentsOf(s, parent).length ? parentsOf(s, parent) : [ensureParent(s, parent, "m")];
        s.parentages.push({ childId: ph.id, parentIds: [...g], kind: "biological" });
      });
      return asChildOf(via);
    }
    case "neveu":
    case "niece": {
      const ps = parentsOf(s, a.id);
      const sibs = ps.length ? s.parentages.filter((p) => p.childId !== a.id && p.parentIds.some((x) => ps.includes(x))).map((p) => p.childId) : [];
      const via = pick(sibs, () => `Frère ou sœur de ${a.givenName}`, "m", (ph) => {
        const g = ps.length ? ps : [ensureParent(s, a.id, "m")];
        s.parentages.push({ childId: ph.id, parentIds: [...g], kind: "biological" });
      });
      return asChildOf(via);
    }
    case "petitfils":
    case "petitefille": {
      const kids = childrenOf(s, a.id);
      const via = pick(kids, () => `Enfant de ${a.givenName}`, "m", (ph) => {
        s.parentages.push({ childId: ph.id, parentIds: [a.id], kind: "biological" });
      });
      return asChildOf(via);
    }
  }
}

/** Pour le formulaire : oncles/tantes, frères/sœurs, enfants d'une personne. */
export function kinChoices(s: Store, anchorId: string) {
  const name = (id: string) => {
    const p = person(s, id);
    return p ? `${p.givenName} ${p.familyName}`.trim() : "";
  };
  const ps = parentsOf(s, anchorId);
  const sibs = ps.length ? s.parentages.filter((p) => p.childId !== anchorId && p.parentIds.some((x) => ps.includes(x))).map((p) => p.childId) : [];
  const unclesBySide = (sex: "m" | "f") => {
    const parent = ps.find((id) => person(s, id)?.sex === sex);
    if (!parent) return [];
    const gp = parentsOf(s, parent);
    return gp.length ? s.parentages.filter((p) => p.childId !== parent && p.parentIds.some((x) => gp.includes(x))).map((p) => p.childId) : [];
  };
  const list = (ids: string[]) => ids.map((id) => ({ id, name: name(id) }));
  return {
    parents: ps.map((id) => ({ id, name: name(id), sex: person(s, id)?.sex ?? "m" })),
    siblings: list(sibs),
    children: list(childrenOf(s, anchorId)),
    unclesM: list(unclesBySide("m")),
    unclesF: list(unclesBySide("f")),
  };
}
