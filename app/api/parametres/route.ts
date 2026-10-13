import type { NextRequest } from "next/server";
import { isLang } from "@/lib/i18n/core";
import { body, needAdmin, ok } from "@/lib/server/api";
import { mutate } from "@/lib/server/store";

// Paramètres de la famille (administrateurs). Les réglages propres à un appareil
// (son, langue d'affichage) sont gardés sur l'appareil lui-même.

export async function PATCH(req: NextRequest) {
  const { err } = needAdmin(req);
  if (err) return err;
  const b = await body(req);
  await mutate((s) => {
    if (typeof b.translateKey === "string") s.settings.translateKey = b.translateKey.trim().slice(0, 200) || undefined;
    if (typeof b.onlineFeatures === "boolean") s.settings.onlineFeatures = b.onlineFeatures;
    if (b.defaultVisibility === "public" || b.defaultVisibility === "famille") s.settings.defaultVisibility = b.defaultVisibility;
    if (isLang(b.language)) s.settings.language = b.language;
  });
  return ok();
}
