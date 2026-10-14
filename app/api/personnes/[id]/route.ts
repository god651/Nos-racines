import type { NextRequest } from "next/server";
import { body, fail, needAdmin, needMember, ok } from "@/lib/server/api";
import { applyPerson, applyRelations } from "@/lib/server/persons";
import { mutate, read } from "@/lib/server/store";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { v, err } = needMember(req);
  if (err) return err;
  const { id } = await params;
  const cur = read().persons.find((p) => p.id === id);
  if (!cur) return fail("Personne introuvable", 404);
  const b = await body(req);
  if (!v.isAdmin) {
    // Un membre peut compléter SA fiche une seule fois ; ensuite, seuls les administrateurs la modifient.
    if (v.user!.personId !== id) return fail("Action réservée aux administrateurs.", 403);
    if (cur.selfEditedAt) return fail("Vous avez déjà complété votre fiche. Pour la changer encore, demandez à un administrateur.", 403);
    await mutate((s) => {
      const p = s.persons.find((x) => x.id === id)!;
      // Ses informations seulement : les liens de parenté restent l'affaire des administrateurs.
      const { parents: _a, spouses: _b, children: _c, parentKind: _d, ...own } = b as Record<string, unknown>;
      void _a, _b, _c, _d;
      applyPerson(p, { ...own, complete: true });
      p.selfEditedAt = Date.now();
    });
    return ok({ id });
  }
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
