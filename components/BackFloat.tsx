"use client";

import { back } from "@/lib/local/router";
import { useT } from "@/lib/i18n/client";

/** Bouton « Retour » pour les écrans ouverts par le scanner. */
export function BackFloat({ inline = false }: { inline?: boolean }) {
  const t = useT();
  return (
    <button
      onClick={() => back()}
      className={
        inline
          ? "mx-auto min-h-12 rounded-full border border-or/50 px-6 text-[14px] text-or-pale"
          : "fixed left-4 top-[max(16px,env(safe-area-inset-top))] z-40 flex h-11 items-center gap-1 rounded-full border border-or-pale/20 bg-nuit/70 px-4 text-[13px] text-coton backdrop-blur-md"
      }
    >
      ← {t("Retour")}
    </button>
  );
}
