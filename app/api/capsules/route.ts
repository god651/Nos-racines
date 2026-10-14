import type { NextRequest } from "next/server";
import { needMember, ok } from "@/lib/server/api";
import { read } from "@/lib/server/store";

// Coffres du futur : leur contenu est chiffré et se gère dans lib/local/coffre.ts.
// Ici, seulement la liste (sans contenu).
export async function GET(req: NextRequest) {
  const { err } = needMember(req);
  if (err) return err;
  const list = read().capsules.map(({ box: _b, text: _t, mediaId: _m, codeHash: _h, salt: _s, ...rest }) => rest);
  return ok({ capsules: list });
}
