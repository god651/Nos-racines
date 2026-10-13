import type { NextRequest } from "next/server";
import { body, fail, ok, txt } from "@/lib/server/api";
import { sessionCookie } from "@/lib/server/auth";
import { mutate, newId, read } from "@/lib/server/store";

const DEVICE_LINK_TTL = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  const b = await body(req);
  const s = read();
  const code = typeof b.token === "string" ? b.token.trim().toUpperCase().replace(/[^A-Z0-9_-]/gi, "") : "";
  const inv = s.invites.find((i) => (i.token === b.token || (i.kind === "account" && i.token === code)) && !i.revoked);
  if (!inv) return fail("Ce QR code n’est plus valable. Demandez-en un nouveau à un administrateur.", 404);
  const token = newId(32);

  if (inv.kind === "account") {
    if (inv.uses > 0) return fail("Ce code a déjà été utilisé. Demandez-en un nouveau au fondateur de la famille.", 410);
    await mutate((st) => {
      st.invites.find((i) => i.token === inv.token)!.uses++;
      st.sessions.push({ token, userId: inv.forUserId!, createdAt: Date.now() });
    });
  } else if (inv.forUserId) {
    if (Date.now() - inv.createdAt > DEVICE_LINK_TTL || inv.uses > 0) return fail("Ce lien a expiré. Générez-en un nouveau depuis votre espace personnel.", 410);
    await mutate((st) => {
      st.invites.find((i) => i.token === inv.token)!.uses++;
      st.sessions.push({ token, userId: inv.forUserId!, createdAt: Date.now() });
    });
  } else {
    const name = txt(b.name, 60);
    if (!name) return fail("Indiquez votre prénom.");
    await mutate((st) => {
      const userId = newId();
      st.users.push({ id: userId, name, role: "membre", createdAt: Date.now() });
      st.sessions.push({ token, userId, createdAt: Date.now() });
      st.invites.find((i) => i.token === inv.token)!.uses++;
    });
  }
  const res = ok();
  res.cookies.set(sessionCookie(token));
  return res;
}
