import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";
import { computeGenerations } from "./genealogy";
import { publicFamilyId } from "./local/sync";
import { fullName, type Parentage, type Person, type Store, type Union } from "./types";

// ═══════════════════════════════════════════════════════════════════
// Ce que contiennent les QR codes.
// • Fiche d'une personne et arbre : un lien Internet ordinaire qui porte les informations
//   elles-mêmes (compressées). N'importe quel téléphone l'ouvre, sans l'application,
//   sans compte et sans serveur : rien n'est stocké en ligne.
// • Rejoindre la famille : un texte que seul le scanner de l'application comprend.
// ═══════════════════════════════════════════════════════════════════

export const JOIN_PREFIX = "NOSRACINES:REJOINDRE:";
export const joinCode = (token: string, cloud = "") => JOIN_PREFIX + token + cloud;

/** Adresse de la page publique qui affiche les fiches et l'arbre. */
export function viewBase(): string {
  const env = import.meta.env.VITE_VIEW_URL as string | undefined;
  if (env) return env;
  try {
    return location.origin + location.pathname.replace(/[^/]*$/, "") + "voir.html";
  } catch {
    return "voir.html";
  }
}

const b64url = (u: Uint8Array) => {
  let s = "";
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};
const pack = (o: unknown) => b64url(deflateSync(strToU8(JSON.stringify(o)), { level: 9 }));
const unpack = <T,>(s: string): T => JSON.parse(strFromU8(inflateSync(unb64url(s)))) as T;

// ─── Fiche d'une personne ───
export interface PersonCard {
  v: 1;
  /** nom de la famille */
  f: string;
  n: string;
  s: "f" | "m";
  l: boolean;
  b?: number;
  d?: number;
  code: string;
  /** fiche publique complète ou seulement le nom */
  pub: boolean;
  /** portrait en ligne : « famille/photo » */
  ph?: string;
  vi?: string;
  ci?: string;
  jo?: string;
  dn?: string;
  q?: string;
  bio?: string;
  pl?: string[];
  pa?: string[];
  co?: string[];
  en?: string[];
}

const cut = (t: string | undefined, n: number) => (t && t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t || undefined);

export function personCard(s: Store, p: Person): PersonCard {
  const pub = p.visibility === "public";
  const name = (id: string) => {
    const x = s.persons.find((q) => q.id === id);
    return x && !x.placeholder ? fullName(x) : undefined;
  };
  const fid = publicFamilyId();
  const card: PersonCard = { v: 1, f: s.family?.name ?? "", n: fullName(p), s: p.sex, l: p.isLiving, b: p.birthYear, d: p.deathYear, code: p.qrCode, pub, ph: fid && p.photoId ? `${fid}/${p.photoId}` : undefined };
  if (!pub) return card;
  Object.assign(card, {
    vi: p.village,
    ci: p.city,
    jo: p.job,
    dn: p.dayName,
    q: cut(p.quote, 160),
    bio: cut(p.bio, 360),
    pl: p.favoriteDishes?.length ? p.favoriteDishes.slice(0, 5) : undefined,
    pa: (s.parentages.find((x) => x.childId === p.id)?.parentIds ?? []).map(name).filter(Boolean),
    co: s.unions.filter((u) => u.partnerA === p.id || u.partnerB === p.id).map((u) => name(u.partnerA === p.id ? u.partnerB : u.partnerA)).filter(Boolean),
    en: s.parentages.filter((x) => x.parentIds.includes(p.id)).map((x) => name(x.childId)).filter(Boolean),
  });
  for (const k of Object.keys(card) as (keyof PersonCard)[]) if (card[k] === undefined || (Array.isArray(card[k]) && !(card[k] as unknown[]).length)) delete card[k];
  return card;
}

export function personLink(s: Store, p: Person) {
  let card = personCard(s, p);
  let link = `${viewBase()}#p=${pack(card)}`;
  // Un QR code reste lisible jusqu'à environ 1 200 caractères : on raccourcit si besoin.
  if (link.length > 1200) {
    card = { ...card, bio: cut(card.bio, 140), en: card.en?.slice(0, 6) };
    link = `${viewBase()}#p=${pack(card)}`;
  }
  if (link.length > 1200) {
    delete card.bio;
    delete card.pl;
    link = `${viewBase()}#p=${pack(card)}`;
  }
  return link;
}

// ─── Arbre entier ───
export interface TreeCard {
  v: 1;
  f: string;
  m?: string;
  vi?: string;
  /** personnes : [nom, sexe, vivant(1/0), naissance, décès] */
  p: [string, "f" | "m", 0 | 1, number?, number?][];
  /** couples : [i, j] ou [i, j, 1, année] si séparés */
  u: number[][];
  /** filiations : [enfant, parent, parent?] */
  c: number[][];
  /** famille en ligne et portrait de chaque personne (même ordre que p ; "" = sans photo) */
  fid?: string;
  ph?: string[];
}

export function treeCard(s: Store, withYears = true, maxGen = 99): TreeCard {
  const gens = computeGenerations(s.persons, s.parentages, s.unions);
  const list = s.persons.filter((p) => (gens.get(p.id) ?? 1) <= maxGen);
  const idx = new Map(list.map((p, i) => [p.id, i]));
  const fid = publicFamilyId();
  const ph = fid ? list.map((p) => (p.placeholder ? "" : p.photoId ?? "")) : undefined;
  return {
    fid: fid && ph?.some(Boolean) ? fid : undefined,
    ph: fid && ph?.some(Boolean) ? ph : undefined,
    v: 1,
    f: s.family?.name ?? "",
    m: s.family?.motto || undefined,
    vi: s.family?.village || undefined,
    p: list.map((p) => {
      const row: TreeCard["p"][number] = [p.placeholder ? "?" : p.familyName ? `${p.givenName}|${p.familyName}` : p.givenName, p.sex, p.isLiving ? 1 : 0];
      if (withYears && (p.birthYear || p.deathYear)) row.push(p.birthYear ?? 0, p.deathYear ?? 0);
      return row;
    }),
    u: s.unions.filter((u) => idx.has(u.partnerA) && idx.has(u.partnerB)).map((u) => (u.separated ? [idx.get(u.partnerA)!, idx.get(u.partnerB)!, 1, u.separatedYear ?? 0] : [idx.get(u.partnerA)!, idx.get(u.partnerB)!])),
    c: s.parentages
      .filter((pa) => idx.has(pa.childId))
      .map((pa) => [idx.get(pa.childId)!, ...pa.parentIds.filter((x) => idx.has(x)).map((x) => idx.get(x)!)])
      .filter((r) => r.length > 1),
  };
}

export function treeLink(s: Store) {
  // QR code d'arbre : jusqu'à environ 2 000 caractères (on l'affiche en grand).
  let link = `${viewBase()}#a=${pack(treeCard(s))}`;
  if (link.length > 2000) {
    const c = treeCard(s);
    delete c.ph;
    delete c.fid;
    link = `${viewBase()}#a=${pack(c)}`;
  }
  if (link.length > 2000) link = `${viewBase()}#a=${pack(treeCard(s, false))}`;
  for (let g = 8; link.length > 2000 && g > 1; g--) link = `${viewBase()}#a=${pack(treeCard(s, false, g))}`;
  return link;
}

// ─── Lecture (page publique et scanner de l'application) ───
export type Decoded = { kind: "person"; card: PersonCard } | { kind: "tree"; card: TreeCard } | { kind: "join"; token: string } | { kind: "unknown"; text: string };

/** « JETON@famille.clé » → le jeton et l'adresse de l'espace en ligne de la famille. */
export function splitJoin(raw: string): { token: string; cloud?: { fid: string; key: string } } {
  const [token, rest] = raw.split("@");
  const dot = rest?.indexOf(".") ?? -1;
  return rest && dot > 0 ? { token, cloud: { fid: rest.slice(0, dot), key: rest.slice(dot + 1) } } : { token };
}

export function decodeShared(text: string): Decoded {
  const t = text.trim();
  if (t.toUpperCase().startsWith(JOIN_PREFIX)) return { kind: "join", token: t.slice(JOIN_PREFIX.length).trim() };
  // Anciens QR codes « …#/rejoindre/CODE ».
  const old = t.match(/#\/rejoindre\/([A-Za-z0-9_-]+)/);
  if (old) return { kind: "join", token: old[1] };
  const hash = t.includes("#") ? t.slice(t.indexOf("#") + 1) : "";
  try {
    if (hash.startsWith("p=")) return { kind: "person", card: unpack<PersonCard>(hash.slice(2)) };
    if (hash.startsWith("a=")) return { kind: "tree", card: unpack<TreeCard>(hash.slice(2)) };
  } catch {}
  return { kind: "unknown", text: t };
}

/** Reconstruit un petit arbre (personnes, couples, filiations) à partir d'un QR code d'arbre. */
export function treeFromCard(card: TreeCard): { persons: Person[]; unions: Union[]; parentages: Parentage[] } {
  const persons: Person[] = card.p.map(([n, sex, liv, b, d], i) => ({
    id: `p${i}`,
    givenName: n.split("|")[0],
    familyName: n.split("|")[1] ?? "",
    sex,
    isLiving: !!liv,
    birthYear: b || undefined,
    deathYear: d || undefined,
    placeholder: n === "?" || undefined,
    photoId: card.ph?.[i] || undefined,
    qrCode: "",
    visibility: "famille",
    timeline: [],
    createdAt: i,
  }));
  return {
    persons,
    unions: card.u.map(([a, b, sep, y], i) => ({ id: `u${i}`, partnerA: `p${a}`, partnerB: `p${b}`, kind: "civil" as Union["kind"], ...(sep ? { separated: true, separatedYear: y || undefined } : {}) })),
    parentages: card.c.map(([c, ...ps]) => ({ childId: `p${c}`, parentIds: ps.map((x) => `p${x}`), kind: "biological" as Parentage["kind"] })),
  };
}
