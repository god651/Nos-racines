import type { NextRequest } from "next/server";
import { body, fail, needAdmin, ok } from "@/lib/server/api";
import { applyPerson, applyRelations } from "@/lib/server/persons";
import { mutate, read } from "@/lib/server/store";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = needAdmin(req);
  if (err) return err;
  const { id } = await params;
  if (!read().persons.some((p) => p.id === id)) return fail("Personne introuvable", 404);
  const b = await body(req);
  await mutate((s) => {
    const p = s.persons.find((x) => x.id === id)!;
    applyPerson(p, { ...b, complete: true });
    applyRelations(s, id, b);
  });
  return ok({ id });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = needAdmin(req);
  if (err) return err;
  const { id } = await params;
  await mutate((s) => {
    s.persons = s.persons.filter((p) => p.id !== id);
    s.unions = s.unions.filter((u) => u.partnerA !== id && u.partnerB !== id);
    s.parentages = s.parentages
      .filter((p) => p.childId !== id)
      .map((p) => ({ ...p, parentIds: p.parentIds.filter((x) => x !== id) }))
      .filter((p) => p.parentIds.length);
    s.tributes = (s.tributes ?? []).filter((x) => x.personId !== id);
    s.memories = s.memories.map((m) => ({ ...m, personIds: m.personIds.filter((x) => x !== id) }));
    // Les récits d'une personne supprimée sont gardés sans auteur plutôt que perdus.
    s.users.forEach((u) => u.personId === id && delete u.personId);
  });
  return ok();
}
