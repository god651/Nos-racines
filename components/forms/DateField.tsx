"use client";

import { useEffect, useRef, useState } from "react";
import { useLang, useT } from "@/lib/i18n/client";

// Saisie d'une date au clavier : jour, mois, année, sans faire défiler de calendrier.
// On tape « 12 », le curseur passe seul au mois, puis à l'année.
// La valeur rendue est « AAAA-MM-JJ » (ou "" si la date est vide ou incomplète).

const split = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
  return m ? { d: m[3], m: m[2], y: m[1] } : { d: "", m: "", y: "" };
};
const valid = (d: string, m: string, y: string, future = false) => {
  if (d.length < 1 || m.length < 1 || y.length !== 4) return false;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  const real = dt.getFullYear() === Number(y) && dt.getMonth() === Number(m) - 1 && dt.getDate() === Number(d);
  // Date passée (naissance, décès) ou date à venir (ouverture d'un coffre du futur).
  return real && (future ? dt.getTime() > Date.now() && Number(y) <= 2200 : Number(y) >= 1800 && dt.getTime() <= Date.now() + 864e5);
};

export function DateField({ label, value, onChange, hint, future = false }: { label: string; value: string; onChange: (v: string) => void; hint?: string; future?: boolean }) {
  const t = useT();
  const lang = useLang();
  const init = split(value);
  const [d, setD] = useState(init.d);
  const [m, setM] = useState(init.m);
  const [y, setY] = useState(init.y);
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Une valeur venue d'ailleurs (fiche rechargée) remplace la saisie.
  useEffect(() => {
    const s = split(value);
    const cur = valid(d, m, y, future) ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : "";
    if (value !== cur && (value || cur)) {
      setD(s.d);
      setM(s.m);
      setY(s.y);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const push = (nd: string, nm: string, ny: string) => {
    if (!nd && !nm && !ny) return onChange("");
    onChange(valid(nd, nm, ny, future) ? `${ny}-${nm.padStart(2, "0")}-${nd.padStart(2, "0")}` : "");
  };
  const digits = (s: string, n: number) => s.replace(/\D/g, "").slice(0, n);

  const complete = valid(d, m, y, future);
  const partial = (d || m || y) && !complete;
  const words = complete ? new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";

  const box = "min-h-12 rounded-[14px] border bg-coton text-center text-[18px] tracking-[1px] text-nuit outline-none focus:border-or placeholder:text-[#B9AE95]";
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-foret">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          ref={refs[0]}
          inputMode="numeric"
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t("Jour")}
          placeholder={t("JJ")}
          value={d}
          onChange={(e) => {
            const v = digits(e.target.value, 2);
            setD(v);
            push(v, m, y);
            // « 4 » ne peut être que le 4 : on passe au mois tout de suite.
            if (v.length === 2 || Number(v) > 3) refs[1].current?.focus();
          }}
          className={`${box} w-[3.4rem] ${partial && !d ? "border-terre/60" : "border-or-pale"}`}
        />
        <span className="text-or-fonce">/</span>
        <input
          ref={refs[1]}
          inputMode="numeric"
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t("Mois")}
          placeholder={t("MM")}
          value={m}
          onChange={(e) => {
            const v = digits(e.target.value, 2);
            setM(v);
            push(d, v, y);
            if (v.length === 2 || Number(v) > 1) refs[2].current?.focus();
          }}
          onKeyDown={(e) => e.key === "Backspace" && !m && refs[0].current?.focus()}
          className={`${box} w-[3.4rem] ${partial && !m ? "border-terre/60" : "border-or-pale"}`}
        />
        <span className="text-or-fonce">/</span>
        <input
          ref={refs[2]}
          inputMode="numeric"
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t("Année")}
          placeholder={t("AAAA")}
          value={y}
          onChange={(e) => {
            const v = digits(e.target.value, 4);
            setY(v);
            push(d, m, v);
          }}
          onKeyDown={(e) => e.key === "Backspace" && !y && refs[1].current?.focus()}
          className={`${box} w-[4.8rem] ${partial && y.length !== 4 ? "border-terre/60" : "border-or-pale"}`}
        />
        {(d || m || y) && (
          <button
            type="button"
            onClick={() => {
              setD("");
              setM("");
              setY("");
              onChange("");
              refs[0].current?.focus();
            }}
            aria-label={t("Effacer la date")}
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-full text-[#9A917F]"
          >
            ✕
          </button>
        )}
      </div>
      <p className={`mt-1 min-h-[16px] text-[12px] ${partial ? "text-terre" : "text-or-fonce"}`}>
        {complete ? words : partial ? (future ? t("Date incomplète, impossible ou déjà passée : jour, mois, puis année sur 4 chiffres.") : t("Date incomplète ou impossible : jour, mois, puis année sur 4 chiffres.")) : hint ?? ""}
      </p>
    </div>
  );
}
