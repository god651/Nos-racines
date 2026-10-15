import type { NextRequest } from "next/server";
import { isLang } from "@/lib/i18n/core";
import { body, fail, int, needEditor, ok, txt } from "@/lib/server/api";
import { mutate, newId, read } from "@/lib/server/store";

export async function POST(req: NextRequest) {
  const { v, err } = needEditor(req);
  if (err) return err;
  const b = await body(req);
  const s = read();
  const personId = txt(b.personId, 40);
  if (!personId || !s.persons.some((p) => p.id === personId)) return fail("Choisissez la personne qui raconte.");
  const audioId = txt(b.audioId, 40);
  const text = txt(b.text, 20000);
  if (!audioId && !text) return fail("Enregistrez la voix ou écrivez le récit.");
  if (audioId && !s.media.some((m) => m.id === audioId)) return fail("Enregistrement introuvable.");
  const id = await mutate((st) => {
    const id = newId();
    st.stories.push({
      id,
      personId,
      title: txt(b.title, 140) ?? "Récit",
      text,
      audioId,
      durationSec: int(b.durationSec, 0, 6 * 3600) ?? 0,
      language: isLang(b.language) ? b.language : "fr",
      createdAt: Date.now(),
      by: v.user!.id,
    });
    return id;
  });
  return ok({ id });
}
