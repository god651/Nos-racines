import type { NextRequest } from "next/server";
import { body, fail, needMember, ok } from "@/lib/server/api";
import { kv } from "@/lib/local/store-core";
import { mutate } from "@/lib/server/store";

// Le créateur de l'application se fait reconnaître avec son code : il devient « Fondateur »
// (titre unique) et ouvre l'espace du fondateur. Personne d'autre, même administrateur.
const CREATOR_HASH = "e9e3ad901f54efca088eff991740713021e26c52929ff1e23572aed296f9ac33";

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: NextRequest) {
  const { v, err } = needMember(req);
  if (err) return err;
  const b = await body(req);
  const code = String(b.code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if ((await sha256(`nos-racines-createur:${code}`)) !== CREATOR_HASH) return fail("Code incorrect.", 403);
  await mutate((s) => {
    // Un seul Fondateur dans la famille : le titre quitte tout autre compte.
    for (const u of s.users) if (u.id !== v.user!.id) delete u.creator;
    const me = s.users.find((u) => u.id === v.user!.id);
    if (me) me.creator = true;
  });
  kv.set("nr_createur", "1");
  kv.set("nr_createur_pin", code);
  // Famille en ligne : le serveur retient aussi que ce compte est celui du créateur.
  const { getLink, claimCreator, refreshMembers } = await import("@/lib/local/sync");
  if (getLink()) await claimCreator(code).then(() => refreshMembers()).catch(() => undefined);
  return ok();
}
