import type { NextRequest } from "next/server";
import { body, fail, needAdmin, ok, txt } from "@/lib/server/api";
import { mutate, newId, read, shortCode } from "@/lib/server/store";

// Comptes créés à l'avance par le fondateur ou un administrateur : en lecture seule,
// chacun reçoit un code d'accès à taper (ou un QR code à scanner) sur son téléphone.

export async function POST(req: NextRequest) {
  const { v, err } = needAdmin(req);
  if (err) return err;
  const b = await body(req);
  const s = read();
  const personId = txt(b.personId, 40);
  if (personId && !s.persons.some((p) => p.id === personId)) return fail("Fiche introuvable.");
  // Nouveau code pour un compte existant.
  if (typeof b.userId === "string") {
    const u = s.users.find((x) => x.id === b.userId);
    if (!u) return fail("Compte introuvable.", 404);
    const code = await mutate((st) => newCode(st, u.id, v.user!.id));
    return ok({ id: u.id, code });
  }
  const name = txt(b.name, 60);
  if (!name) return fail("Indiquez le prénom de la personne.");
  const res = await mutate((st) => {
    const id = newId();
    st.users.push({ id, name, role: "membre", personId, createdAt: Date.now() });
    return { id, code: newCode(st, id, v.user!.id) };
  });
  return ok(res);
}

function newCode(st: ReturnType<typeof read>, userId: string, by: string) {
  st.invites = st.invites.filter((i) => !(i.forUserId === userId && i.kind === "account"));
  const code = shortCode(8, new Set(st.invites.map((i) => i.token)));
  st.invites.push({ token: code, createdAt: Date.now(), createdBy: by, uses: 0, forUserId: userId, kind: "account" });
  return code;
}
