import type { NextRequest } from "next/server";
import { body, fail, int, needMember, ok, txt } from "@/lib/server/api";
import { mutate, newId, read } from "@/lib/server/store";

// Capsule temporelle : tout membre peut en sceller une (c'est un message personnel, pas une modification de l'arbre).
// Son contenu n'est renvoyé à personne avant la date d'ouverture, pas même à son auteur.

export async function GET(req: NextRequest) {
  const { v, err } = needMember(req);
  if (err) return err;
  const year = new Date().getFullYear();
  const list = read()
    .capsules.filter((c) => c.by === v.user!.id || c.openYear <= year)
    .map((c) => (c.openYear <= year ? c : { ...c, text: undefined, mediaId: undefined }));
  return ok({ capsules: list });
}

export async function POST(req: NextRequest) {
  const { v, err } = needMember(req);
  if (err) return err;
  const b = await body(req);
  const openYear = int(b.openYear, new Date().getFullYear() + 1, 2200);
  if (!openYear) return fail("Choisissez une année d’ouverture dans le futur.");
  const text = txt(b.text, 20000);
  const mediaId = txt(b.mediaId, 40);
  if (!text && !mediaId) return fail("Écrivez la lettre ou enregistrez un message.");
  const id = await mutate((s) => {
    const id = newId();
    s.capsules.push({
      id,
      by: v.user!.id,
      byName: v.user!.name,
      recipients: txt(b.recipients, 80) ?? "",
      openYear,
      kind: b.kind === "audio" ? "audio" : b.kind === "video" ? "video" : "letter",
      text,
      mediaId,
      createdAt: Date.now(),
    });
    return id;
  });
  return ok({ id });
}
