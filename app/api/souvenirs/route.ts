import type { NextRequest } from "next/server";
import { body, fail, int, needAdmin, ok, txt } from "@/lib/server/api";
import { mutate, newId, read } from "@/lib/server/store";

export async function POST(req: NextRequest) {
  const { v, err } = needAdmin(req);
  if (err) return err;
  const b = await body(req);
  const s = read();
  const caption = txt(b.caption, 200);
  const photoId = txt(b.photoId, 40);
  if (!caption && !photoId) return fail("Ajoutez une photo ou une légende.");
  const personIds = Array.isArray(b.personIds) ? (b.personIds as unknown[]).filter((x): x is string => typeof x === "string" && s.persons.some((p) => p.id === x)) : [];
  const id = await mutate((st) => {
    const id = newId();
    st.memories.push({ id, personIds, caption: caption ?? "", year: int(b.year, 1800, 2100), photoId, createdAt: Date.now(), by: v.user!.id });
    return id;
  });
  return ok({ id });
}
