import type { NextRequest } from "next/server";
import { isLang } from "@/lib/i18n/core";
import { body, fail, needMember, ok } from "@/lib/server/api";
import { read } from "@/lib/server/store";
import { isOnline, translateMany } from "@/lib/server/translate";

// Traduction à la demande d'un texte de la famille (biographie, récit…) — nécessite Internet.

export async function POST(req: NextRequest) {
  const { err } = needMember(req);
  if (err) return err;
  const b = await body(req);
  if (!isLang(b.target) || typeof b.text !== "string" || !b.text.trim()) return fail("Rien à traduire.");
  if (!read().settings.onlineFeatures) return fail("Les fonctions en ligne sont désactivées dans les paramètres.", 503);
  if (!(await isOnline())) return fail("Pas de connexion Internet pour le moment.", 503);
  try {
    const [out] = await translateMany([b.text.slice(0, 5000)], b.target, isLang(b.source) ? b.source : "fr");
    return ok({ text: out });
  } catch (e) {
    return fail((e as Error).message === "NO_KEY" ? "Aucune clé Google Traduction n’est configurée." : "La traduction a échoué.", 503);
  }
}
