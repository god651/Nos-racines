import type { NextRequest } from "next/server";
import { isLang } from "@/lib/i18n/core";
import { EN } from "@/lib/i18n/en";
import { LANG_COOKIE } from "@/lib/server/auth";
import { body, fail, ok } from "@/lib/server/api";
import { mutate, read } from "@/lib/server/store";
import { isOnline, translateMany } from "@/lib/server/translate";

// Choix de la langue d'affichage sur cet appareil.
// Pour le baoulé et le dioula, l'interface est traduite une seule fois par Google (connexion requise),
// puis gardée sur l'ordinateur de la famille : ensuite, plus besoin d'Internet.

export async function POST(req: NextRequest) {
  const b = await body(req);
  if (!isLang(b.lang)) return fail("Langue inconnue.");
  const lang = b.lang;
  let status: "ok" | "translated" | "offline" | "no-key" | "error" = "ok";

  if (lang === "bci" || lang === "dyu") {
    const s = read();
    const keys = Object.keys(EN);
    const have = s.translations[lang] ?? {};
    const missing = keys.filter((k) => !have[k]);
    if (missing.length) {
      if (!s.settings.onlineFeatures) status = "offline";
      else if (!(await isOnline())) status = "offline";
      else {
        try {
          const out = await translateMany(missing, lang);
          await mutate((st) => {
            const d = (st.translations[lang] = st.translations[lang] ?? {});
            missing.forEach((k, i) => (d[k] = out[i]));
          });
          status = "translated";
        } catch {
          status = "error";
        }
      }
    }
  }
  const res = ok({ status });
  res.cookies.set({ name: LANG_COOKIE, value: lang, path: "/", maxAge: 60 * 60 * 24 * 365 * 5, sameSite: "lax" });
  return res;
}
