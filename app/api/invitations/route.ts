import type { NextRequest } from "next/server";
import { body, fail, needAdmin, needMember, ok } from "@/lib/server/api";
import { mutate, newId } from "@/lib/server/store";

// Invitation : un QR code qui permet à un proche de rejoindre la famille en lecture seule.
// Lien d'appareil : un QR code à usage unique (30 min) pour ouvrir SON compte sur un autre téléphone.

export async function POST(req: NextRequest) {
  const b = await body(req);
  if (b.device) {
    const { v, err } = needMember(req);
    if (err) return err;
    const token = newId(24);
    await mutate((s) => {
      s.invites = s.invites.filter((i) => !(i.forUserId === v.user!.id));
      s.invites.push({ token, createdAt: Date.now(), createdBy: v.user!.id, uses: 0, forUserId: v.user!.id });
    });
    return ok({ token });
  }
  const { v, err } = needAdmin(req);
  if (err) return err;
  const token = newId(16);
  await mutate((s) => {
    if (s.invites.filter((i) => !i.revoked && !i.forUserId).length >= 10) {
      // On garde les 10 invitations les plus récentes.
      const old = s.invites.filter((i) => !i.revoked && !i.forUserId).sort((a, c) => a.createdAt - c.createdAt)[0];
      old.revoked = true;
    }
    s.invites.push({ token, createdAt: Date.now(), createdBy: v.user!.id, uses: 0 });
  });
  return ok({ token });
}

export async function DELETE(req: NextRequest) {
  const { err } = needAdmin(req);
  if (err) return err;
  const b = await body(req);
  if (typeof b.token !== "string") return fail("Invitation inconnue.");
  await mutate((s) => {
    const i = s.invites.find((x) => x.token === b.token);
    if (i) i.revoked = true;
  });
  return ok();
}
