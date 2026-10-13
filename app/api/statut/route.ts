import { ok } from "@/lib/server/api";
import { read } from "@/lib/server/store";
import { isOnline, translateKey } from "@/lib/server/translate";

export const dynamic = "force-dynamic";

/** État des fonctions en ligne, affiché dans les paramètres. */
export async function GET() {
  const s = read();
  const online = s.settings.onlineFeatures ? await isOnline() : false;
  return ok({
    online,
    onlineFeatures: s.settings.onlineFeatures,
    translate: Boolean(translateKey()),
    translated: { bci: Object.keys(s.translations.bci ?? {}).length, dyu: Object.keys(s.translations.dyu ?? {}).length },
  });
}
