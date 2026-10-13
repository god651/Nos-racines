import type { Person } from "./types";

// Anniversaires de naissance et de décès (dates exactes facultatives AAAA-MM-JJ).

export interface Anniv {
  personId: string;
  kind: "birth" | "death";
  /** Nombre d'années atteint à cette date. */
  years: number;
  /** Dans combien de jours (0 = aujourd'hui). */
  inDays: number;
  date: Date;
}

const DAY = 86400000;

function next(dateStr: string, now: Date) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let occ = new Date(today.getFullYear(), m - 1, d);
  if (occ < today) occ = new Date(today.getFullYear() + 1, m - 1, d);
  return { date: occ, years: occ.getFullYear() - y, inDays: Math.round((occ.getTime() - today.getTime()) / DAY) };
}

export function anniversaries(persons: Person[], withinDays = 30, now = new Date()): Anniv[] {
  const out: Anniv[] = [];
  for (const p of persons) {
    if (p.placeholder) continue;
    if (p.birthDate) {
      const n = next(p.birthDate, now);
      if (n.inDays <= withinDays && n.years > 0) out.push({ personId: p.id, kind: "birth", ...n });
    }
    if (!p.isLiving && p.deathDate) {
      const n = next(p.deathDate, now);
      if (n.inDays <= withinDays && n.years > 0) out.push({ personId: p.id, kind: "death", ...n });
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}
