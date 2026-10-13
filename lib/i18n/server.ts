import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE } from "../server/auth";
import { read } from "../server/store";
import type { Lang } from "../types";
import { isLang, makeT, type Dict } from "./core";
import { EN } from "./en";

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(c)) return c;
  return read().settings.language ?? "fr";
}

export function dictFor(lang: Lang): Dict {
  if (lang === "en") return EN;
  if (lang === "bci" || lang === "dyu") return read().translations[lang] ?? {};
  return {};
}

export async function getT() {
  const lang = await getLang();
  const dict = dictFor(lang);
  return { t: makeT(dict), lang, dict };
}
