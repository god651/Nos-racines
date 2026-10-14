import "server-only";
import type { ParentageKind, Person, Store, UnionKind } from "../types";
import { int, txt } from "./api";
import { newId } from "./store";

// Application d'un formulaire « personne » et de ses liens familiaux.

export function applyPerson(p: Person, b: Record<string, unknown>) {
  const set = <K extends keyof Person>(k: K, v: Person[K] | undefined) => {
    if (v === undefined) delete p[k];
    else p[k] = v;
  };
  if ("givenName" in b) p.givenName = txt(b.givenName, 60) ?? p.givenName;
  if ("familyName" in b) p.familyName = txt(b.familyName, 60) ?? "";
  if ("nickname" in b) set("nickname", txt(b.nickname, 60));
  if ("dayName" in b) set("dayName", txt(b.dayName, 40));
  if ("dayNameMeaning" in b) set("dayNameMeaning", txt(b.dayNameMeaning, 80));
  if ("sex" in b) p.sex = b.sex === "f" ? "f" : "m";
  if ("birthYear" in b) set("birthYear", int(b.birthYear, 1500, 2100));
  if ("deathYear" in b) set("deathYear", int(b.deathYear, 1500, 2100));
  if ("isLiving" in b) p.isLiving = b.isLiving !== false;
  if (!p.isLiving && p.deathYear === undefined) p.isLiving = false;
  if (p.deathYear) p.isLiving = false;
  if ("village" in b) set("village", txt(b.village, 80));
  if ("city" in b) set("city", txt(b.city, 80));
  if ("job" in b) set("job", txt(b.job, 80));
  if ("ethnicity" in b) set("ethnicity", txt(b.ethnicity, 60));
  if ("clan" in b) set("clan", txt(b.clan, 60));
  if ("bio" in b) set("bio", txt(b.bio, 4000));
  if ("quote" in b) set("quote", txt(b.quote, 240));
  if ("animatePortrait" in b) p.animatePortrait = b.animatePortrait !== false;
  if (Array.isArray(b.favoriteDishes)) {
    const dishes = [...new Set((b.favoriteDishes as unknown[]).map((x) => txt(x, 60)).filter(Boolean) as string[])].slice(0, 5);
    set("favoriteDishes", dishes.length ? dishes : undefined);
  }
  if ("photoId" in b) set("photoId", txt(b.photoId, 40));
  if (Array.isArray(b.photoIds)) {
    const ids = [...new Set((b.photoIds as unknown[]).map((x) => txt(x, 40)).filter(Boolean) as string[])].slice(0, 3);
    set("photoIds", ids.length ? ids : undefined);
    set("photoId", ids[0]);
  } else if ("photoId" in b) set("photoIds", p.photoId ? [p.photoId] : undefined);
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? v : undefined);
  if ("birthDate" in b) {
    set("birthDate", date(b.birthDate));
    if (p.birthDate) p.birthYear = Number(p.birthDate.slice(0, 4));
  }
  if ("deathDate" in b) {
    set("deathDate", date(b.deathDate));
    if (p.deathDate) {
      p.deathYear = Number(p.deathDate.slice(0, 4));
      p.isLiving = false;
    }
  }
  if (p.isLiving) delete p.deathDate;
  // Une case « à compléter » devient une vraie personne dès qu'on enregistre sa fiche.
  if (p.placeholder && b.complete === true) delete p.placeholder;
  if ("visibility" in b) p.visibility = b.visibility === "public" ? "public" : "famille";
  if (Array.isArray(b.timeline)) {
    p.timeline = (b.timeline as { year?: unknown; text?: unknown }[])
      .map((e) => ({ year: int(e.year, 1500, 2100), text: txt(e.text, 200) }))
      .filter((e): e is { year: number; text: string } => e.year !== undefined && !!e.text)
      .sort((a, c) => a.year - c.year)
      .slice(0, 60);
  }
}

const PKINDS: ParentageKind[] = ["biological", "adoptive", "fostered", "guardianship"];
const UKINDS: UnionKind[] = ["civil", "customary", "religious"];

/** Remplace les parents et les conjoints d'une personne par ceux du formulaire. */
export function applyRelations(s: Store, id: string, b: Record<string, unknown>) {
  const exists = (x: unknown): x is string => typeof x === "string" && x !== id && s.persons.some((p) => p.id === x);

  if (Array.isArray(b.parents)) {
    const parentIds = [...new Set((b.parents as unknown[]).filter(exists))].slice(0, 2);
    // Empêche de se déclarer parent de son propre ancêtre (boucle).
    const ancestors = new Set<string>();
    const walk = (x: string) => s.parentages.find((p) => p.childId === x)?.parentIds.forEach((y) => !ancestors.has(y) && (ancestors.add(y), walk(y)));
    const descendants = new Set<string>();
    const down = (x: string) => s.parentages.filter((p) => p.parentIds.includes(x)).forEach((p) => !descendants.has(p.childId) && (descendants.add(p.childId), down(p.childId)));
    down(id);
    void walk;
    const safe = parentIds.filter((x) => !descendants.has(x));
    s.parentages = s.parentages.filter((p) => p.childId !== id);
    if (safe.length) {
      const kind = PKINDS.includes(b.parentKind as ParentageKind) ? (b.parentKind as ParentageKind) : "biological";
      s.parentages.push({ childId: id, parentIds: safe, kind });
    }
  }

  if (Array.isArray(b.spouses)) {
    const list = (b.spouses as { id?: unknown; kind?: unknown; rank?: unknown; separated?: unknown; separatedYear?: unknown }[]).filter((x) => exists(x.id)).slice(0, 8);
    s.unions = s.unions.filter((u) => u.partnerA !== id && u.partnerB !== id);
    for (const sp of list) {
      s.unions.push({
        id: newId(),
        partnerA: sp.id as string,
        partnerB: id,
        kind: UKINDS.includes(sp.kind as UnionKind) ? (sp.kind as UnionKind) : "customary",
        rank: int(sp.rank, 1, 12),
        ...(sp.separated === true ? { separated: true, separatedYear: int(sp.separatedYear, 1800, 2100) } : {}),
      });
    }
  }

  if (Array.isArray(b.children)) {
    // Ajout d'enfants depuis la fiche d'un parent (sans retirer leurs autres parents).
    for (const c of (b.children as unknown[]).filter(exists)) {
      const pa = s.parentages.find((p) => p.childId === c);
      if (pa) {
        if (!pa.parentIds.includes(id) && pa.parentIds.length < 2) pa.parentIds.push(id);
      } else s.parentages.push({ childId: c, parentIds: [id], kind: "biological" });
    }
  }
}
