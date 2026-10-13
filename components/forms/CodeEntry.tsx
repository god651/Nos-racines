"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { ScanButton } from "@/components/Scanner";

/** Saisie du code d'accès donné par le fondateur (8 caractères). */
export function CodeEntry({ dark = false }: { dark?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (
    <div>
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length >= 6) router.push(`/rejoindre/${clean}`);
      }}
      className="flex gap-2"
    >
      <label className="min-w-0 flex-1">
        <span className="sr-only">{t("Code d’accès")}</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="K7M2-QX4P"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={12}
          className={`w-full rounded-[14px] border px-4 py-3 text-center font-serif text-[20px] tracking-[3px] outline-none ${dark ? "border-or-pale/30 bg-coton/10 text-coton placeholder:text-or-pale/40 focus:border-or" : "border-or-pale bg-coton text-nuit focus:border-or"}`}
        />
      </label>
      <button type="submit" disabled={clean.length < 6} className="rounded-full bg-or px-5 text-sm font-semibold text-nuit disabled:opacity-40">
        {t("Entrer")}
      </button>
    </form>
    <ScanButton
      label={t("Ou scanner le QR code reçu")}
      className={`mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border text-[14px] ${dark ? "border-or-pale/30 text-or-pale" : "border-or-pale text-foret"}`}
    />
    </div>
  );
}
