import type { Parentage, Person, Store, Union } from "./types";

// Calculs sur l'arbre : générations, liens, statistiques réelles.

/** Génération de chaque personne : on parcourt les liens (parent : +1 rangée, enfant : -1, conjoint : même rangée)
 *  à partir de l'aîné connu, puis on numérote à partir de 1. Ainsi la famille d'un conjoint
 *  (ses parents, ses frères) se place à la bonne hauteur, à côté de celle de l'autre conjoint. */
export function computeGenerations(persons: Person[], parentages: Parentage[], unions: Union[]) {
  const ids = new Set(persons.map((p) => p.id));
  const edges = new Map<string, { to: string; d: number }[]>();
  const add = (a: string, b: string, d: number) => {
    if (!ids.has(a) || !ids.has(b)) return;
    edges.set(a, [...(edges.get(a) ?? []), { to: b, d }]);
  };
  for (const pa of parentages)
    for (const par of pa.parentIds) {
      add(par, pa.childId, 1);
      add(pa.childId, par, -1);
    }
  for (const u of unions) {
    add(u.partnerA, u.partnerB, 0);
    add(u.partnerB, u.partnerA, 0);
  }
  const gen = new Map<string, number>();
  // On commence par les vraies personnes les plus anciennes (les cases « à compléter » en dernier).
  const order = [...persons].sort((a, b) => Number(!!a.placeholder) - Number(!!b.placeholder) || (a.birthYear ?? 9999) - (b.birthYear ?? 9999) || a.createdAt - b.createdAt);
  for (const start of order) {
    if (gen.has(start.id)) continue;
    const comp: string[] = [];
    gen.set(start.id, 0);
    const queue = [start.id];
    while (queue.length) {
      const x = queue.shift()!;
      comp.push(x);
      // Les liens parent/enfant passent avant les liens de couple.
      for (const e of [...(edges.get(x) ?? [])].sort((a, b) => Math.abs(b.d) - Math.abs(a.d))) {
        if (gen.has(e.to)) continue;
        gen.set(e.to, gen.get(x)! + e.d);
        queue.push(e.to);
      }
    }
    const min = Math.min(...comp.map((x) => gen.get(x)!));
    for (const x of comp) gen.set(x, gen.get(x)! - min + 1);
  }
  return gen;
}

export function familyStats(s: Pick<Store, "persons" | "parentages" | "unions" | "memories" | "stories">) {
  const gens = computeGenerations(s.persons, s.parentages, s.unions);
  const real = s.persons.filter((p) => !p.placeholder);
  // Les cases « à compléter » ne comptent pas comme des membres.
  const generations = real.length ? new Set(real.map((p) => gens.get(p.id))).size : 0;
  const voiceSec = s.stories.reduce((t, x) => t + (x.durationSec || 0), 0);
  return {
    members: real.length,
    generations,
    memories: s.memories.length,
    stories: s.stories.length,
    voiceSec,
  };
}

/** « 0 min », « 12 min », « 1,5 h » */
export function formatVoice(sec: number) {
  if (sec < 3600) return { value: Math.round(sec / 60), unit: "min" };
  return { value: Math.round((sec / 3600) * 10) / 10, unit: "h" };
}

export function parentsOf(s: Pick<Store, "parentages" | "persons">, id: string) {
  const ids = s.parentages.find((p) => p.childId === id)?.parentIds ?? [];
  return ids.map((x) => s.persons.find((p) => p.id === x)).filter(Boolean) as Person[];
}

export function childrenOf(s: Pick<Store, "parentages" | "persons">, id: string) {
  return s.parentages.filter((p) => p.parentIds.includes(id)).map((p) => s.persons.find((x) => x.id === p.childId)).filter(Boolean) as Person[];
}

export function spousesOf(s: Pick<Store, "unions" | "persons">, id: string) {
  return s.unions
    .filter((u) => u.partnerA === id || u.partnerB === id)
    .map((u) => ({ union: u, person: s.persons.find((p) => p.id === (u.partnerA === id ? u.partnerB : u.partnerA)) }))
    .filter((x) => x.person) as { union: Union; person: Person }[];
}

export function siblingsOf(s: Pick<Store, "parentages" | "persons">, id: string) {
  const ps = new Set(s.parentages.find((p) => p.childId === id)?.parentIds ?? []);
  if (!ps.size) return [];
  return s.parentages
    .filter((p) => p.childId !== id && p.parentIds.some((x) => ps.has(x)))
    .map((p) => s.persons.find((x) => x.id === p.childId))
    .filter(Boolean) as Person[];
}
