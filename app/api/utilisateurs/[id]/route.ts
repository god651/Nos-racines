import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/server/auth";
import { body, fail, needMember, ok, txt } from "@/lib/server/api";
import { mutate, read } from "@/lib/server/store";
import { MAX_ADMINS, ownerIdOf } from "@/lib/types";

// Gestion des comptes : renommer, se lier à sa fiche, nommer ou retirer un administrateur (3 au maximum).

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { v, err } = needMember(req);
  if (err) return err;
  const { id } = await params;
  const isSelf = v.user!.id === id;
  if (!isSelf && !v.isAdmin) return fail("Seul un administrateur peut modifier un autre compte.", 403);
  const b = await body(req);
  const s = read();
  const target = s.users.find((u) => u.id === id);
  if (!target) return fail("Compte introuvable.", 404);

  if (b.role !== undefined) {
    // Déléguer les droits est réservé au fondateur de la famille.
    if (!v.isOwner) return fail("Seul le fondateur de la famille peut nommer ou retirer un administrateur.", 403);
    if (ownerIdOf(s) === id) return fail("Le fondateur reste toujours administrateur.");
    const admins = s.users.filter((u) => u.role === "admin");
    if (b.role === "admin" && target.role !== "admin" && admins.length >= MAX_ADMINS) {
      return fail("La famille a déjà 3 administrateurs. Retirez-en un d’abord.");
    }
    if (b.role === "membre" && target.role === "admin" && admins.length <= 1) {
      return fail("Il faut garder au moins un administrateur.");
    }
  }
  if (b.personId !== undefined && b.personId !== null && !s.persons.some((p) => p.id === b.personId)) return fail("Fiche introuvable.");

  await mutate((st) => {
    const u = st.users.find((x) => x.id === id)!;
    if (b.name !== undefined) u.name = txt(b.name, 60) ?? u.name;
    if (b.role === "admin" || b.role === "membre") u.role = b.role;
    if (b.personId === null) delete u.personId;
    else if (typeof b.personId === "string") u.personId = b.personId;
  });
  return ok();
}

/** Retirer un compte (administrateur) ou quitter la famille (soi-même). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { v, err } = needMember(req);
  if (err) return err;
  const { id } = await params;
  if (v.user!.id !== id && !v.isAdmin) return fail("Action réservée aux administrateurs.", 403);
  const s = read();
  const t = s.users.find((u) => u.id === id);
  if (ownerIdOf(s) === id) return fail("Le fondateur ne peut pas quitter la famille.");
  if (t?.role === "admin" && v.user!.id !== id && !v.isOwner) return fail("Seul le fondateur de la famille peut retirer un administrateur.", 403);
  if (t?.role === "admin" && s.users.filter((u) => u.role === "admin").length <= 1) {
    return fail("Le dernier administrateur ne peut pas partir : nommez d’abord un autre administrateur.");
  }
  await mutate((st) => {
    st.users = st.users.filter((u) => u.id !== id);
    st.sessions = st.sessions.filter((x) => x.userId !== id);
    st.invites = st.invites.filter((x) => x.forUserId !== id);
  });
  const res = ok();
  if (v.user!.id === id) res.cookies.delete(SESSION_COOKIE);
  return res;
}
