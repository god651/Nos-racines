import type { NextRequest } from "next/server";
import { fail, needMember, ok } from "@/lib/server/api";
import { mutate, newId } from "@/lib/server/store";
import { putMedia } from "@/lib/local/store-core";

// Envoi d'une photo (déjà allégée sur le téléphone) ou d'un enregistrement audio.

const MAX = 25 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/opus": "opus",
};

export async function POST(req: NextRequest) {
  const { v, err } = needMember(req);
  if (err) return err;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof Blob)) return fail("Aucun fichier reçu.");
  if (file.size > MAX) return fail("Fichier trop lourd (25 Mo au maximum).");
  const mime = (file.type || "").split(";")[0];
  const ext = EXT[mime];
  if (!ext) return fail("Format non pris en charge.");
  const kind = mime.startsWith("audio/") ? "audio" : "photo";
  // Un membre peut envoyer une photo (sa propre fiche, complétée une fois) ; ce qui l'utilise reste contrôlé ailleurs.

  const id = newId(16);
  const name = `${id}.${ext}`;
  await putMedia(id, file.type ? file : new Blob([file], { type: mime }));
  await mutate((s) => {
    s.media.push({ id, kind, mime, file: name, size: file.size, isPublic: form.get("public") === "1", createdAt: Date.now(), by: v.user!.id });
  });
  return ok({ id, url: `/api/medias/${id}` });
}
