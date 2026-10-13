"use client";

import { createContext, useContext, useMemo } from "react";
import type { Lang } from "../types";
import { makeT, type Dict, type T } from "./core";

const Ctx = createContext<{ lang: Lang; t: T }>({ lang: "fr", t: makeT({}) });

export function I18nProvider({ lang, dict, children }: { lang: Lang; dict: Dict; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, t: makeT(dict) }), [lang, dict]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx).t;
export const useLang = () => useContext(Ctx).lang;
