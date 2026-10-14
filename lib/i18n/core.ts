import type { Lang } from "../types";

// Système de langues : le texte français sert de clé.
// - français : texte tel quel ;
// - anglais : dictionnaire relu (lib/i18n/en.ts) ;
// - baoulé et dioula : traduits une fois par Google Traduction quand Internet est disponible,
//   puis gardés sur l'ordinateur de la famille (fonctionne ensuite hors connexion).
// Une phrase absente d'un dictionnaire s'affiche en français : l'application ne casse jamais.

export type Dict = Record<string, string>;
export type Vars = Record<string, string | number>;
export type T = (fr: string, vars?: Vars) => string;

/** Marque un texte à traduire plus tard avec t(variable) (repéré par scripts/textes.mjs). */
export const tx = (fr: string) => fr;

export const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: "fr", label: tx("Français"), native: "Français" },
  { code: "en", label: tx("Anglais"), native: "English" },
  { code: "bci", label: tx("Baoulé"), native: "Baoulé" },
  { code: "dyu", label: tx("Dioula"), native: "Dioula" },
];

export function makeT(dict: Dict): T {
  return (fr, vars) => {
    let s = dict[fr] ?? fr;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

export const isLang = (x: unknown): x is Lang => x === "fr" || x === "en" || x === "bci" || x === "dyu";
