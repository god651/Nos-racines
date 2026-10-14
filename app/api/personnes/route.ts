import type { NextRequest } from "next/server";
import { body, fail, needAdmin, ok, txt } from "@/lib/server/api";
import { addRelative, KinError, RELATION_SEX, RELATIONS, type Relation } from "@/lib/server/kinship";
import { applyPerson, applyRelations } from "@/lib/server/persons";
import { mutate, newId, read, shortCode } from "@/lib/server/store";
import type { Person } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { v, err } = needAdmin(req);
  if (err) return err;
  const b = await body(req);
  if (typeof b.givenName !== "string" || !b.givenName.trim()) return fail("Le prénom est obligatoire.");
  const relation = RELATIONS.includes(b.relation as Relation) ? (b.relation as Relation) : null;
  const anchorId = txt(b.anchorId, 40);
  if (relation && (!anchorId || !read().persons.some((p) => p.id === anchorId))) return fail("Choisissez la personne de référence.");
  try {
    const id = await mutate((s) => {
      // En cas d'erreur, on remet l'arbre exactement comme avant.
      const snap = JSON.parse(JSON.stringify({ persons: s.persons, parentages: s.parentages, unions: s.unions }));
      try {
        return create(s);
      } catch (e) {
        Object.assign(s, snap);
        throw e;
      }
    });
    return ok({ id });
  } catch (e) {
    if (e instanceof KinError) return fail(e.message);
    throw e;
  }

  function create(s: Parameters<Parameters<typeof mutate>[0]>[0]) {
      let p: Person;
      if (relation) {
        // Ajout par lien de parenté : l'arbre se range tout seul.
        const newId_ = addRelative(s, anchorId!, relation, { givenName: b.givenName as string }, { side: b.side === "f" ? "f" : "m", viaId: txt(b.viaId, 40), otherParentId: txt(b.otherParentId, 40) });
        p = s.persons.find((x) => x.id === newId_)!;
        const { parents: _p, spouses: _s, children: _c, ...rest } = b;
        void _p;
        void _s;
        void _c;
        applyPerson(p, rest);
        p.sex = RELATION_SEX[relation];
      } else {
        p = {
          id: newId(),
          givenName: "",
          familyName: "",
          sex: "m",
          isLiving: true,
          qrCode: shortCode(4, new Set(s.persons.map((x) => x.qrCode))),
          visibility: s.settings.defaultVisibility,
          timeline: [],
          createdAt: Date.now(),
        };
        applyPerson(p, b);
        s.persons.push(p);
        applyRelations(s, p.id, b);
      }
      if (b.isMe === true) {
        const u = s.users.find((x) => x.id === v.user!.id);
        if (u) u.personId = p.id;
      }
      return p.id;
  }
}
