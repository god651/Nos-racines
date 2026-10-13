import "server-only";
import type { PersonOption } from "@/components/forms/PersonForm";
import { fullName, type ParentageKind, type Store, type UnionKind } from "../types";

export function personOptions(s: Store): PersonOption[] {
  return s.persons.map((p) => ({ id: p.id, name: fullName(p), sex: p.sex, birthYear: p.birthYear, photoId: p.photoId })).sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999));
}

export function relationsOf(s: Store, id: string) {
  const pa = s.parentages.find((x) => x.childId === id);
  return {
    parents: pa?.parentIds ?? [],
    parentKind: (pa?.kind ?? "biological") as ParentageKind,
    spouses: s.unions
      .filter((u) => u.partnerA === id || u.partnerB === id)
      .map((u) => ({ id: u.partnerA === id ? u.partnerB : u.partnerA, kind: u.kind as UnionKind, rank: u.rank })),
    children: [] as string[],
  };
}
