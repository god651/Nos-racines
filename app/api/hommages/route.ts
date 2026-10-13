import type { NextRequest } from "next/server";
import { body, fail, needMember, ok, txt } from "@/lib/server/api";
import { mutate, newId, read } from "@/lib/server/store";

// Hommages au mémorial d'un défunt : tous les membres peuvent allumer une bougie ou laisser un mot.

export async function POST(req: NextRequest) {
  const { v, err } = needMember(req);
  if (err) return err;
  const b = await body(req);
  const s = read();
  const p = s.persons.find((x) => x.id === b.personId);
  if (!p || p.isLiving) return fail("Mémorial introuvable.", 404);
  const kind = b.kind === "message" ? "message" : "candle";
  const text = txt(b.text, 1000);
  if (kind === "message" && !text) return fail("Écrivez quelques mots.");
  if (kind === "candle") {
    const today = new Date().toDateString();
    const already = s.tributes.some((x) => x.personId === p.id && x.kind === "candle" && x.by === v.user!.id && new Date(x.createdAt).toDateString() === today);
    if (already) return fail("Vous avez déjà allumé une bougie aujourd’hui.");
  }
  const id = await mutate((st) => {
    const id = newId();
    const me = st.persons.find((x) => x.id === v.user!.personId);
    st.tributes.push({ id, personId: p.id, kind, text: kind === "message" ? text : undefined, byName: me?.givenName ?? v.user!.name, by: v.user!.id, createdAt: Date.now() });
    return id;
  });
  return ok({ id });
}
