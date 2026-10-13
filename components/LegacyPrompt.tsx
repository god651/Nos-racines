"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { dismissLegacy, restoreLegacy, type Legacy } from "@/lib/local/store-core";
import { navigate } from "@/lib/local/router";

/** Une famille créée avec une version précédente a été retrouvée : on propose de la ramener. */
export function LegacyPrompt({ legacy }: { legacy: Legacy }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[72] flex items-end justify-center bg-nuit/70 p-4 backdrop-blur-sm">
      <motion.div initial={{ y: 40 }} animate={{ y: 0 }} className="mb-6 w-full max-w-[400px] rounded-[24px] bg-coton p-5 text-ebene shadow-doux">
        <p className="font-serif text-[22px] leading-tight text-nuit">{t("Votre famille est retrouvée")}</p>
        <p className="mt-2 text-[15px] leading-relaxed text-[#3E3A32]">
          {t("« {nom} » ({n} personne(s)) a été créée avant la mise à jour. Voulez-vous la récupérer ? Elle remplacera la famille ouverte en ce moment.", { nom: legacy.familyName, n: legacy.persons })}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await restoreLegacy();
              navigate("/accueil", true);
            }}
            className="min-h-12 rounded-full bg-or text-[15px] font-semibold text-nuit disabled:opacity-60"
          >
            {busy ? "…" : t("Récupérer ma famille")}
          </button>
          <button disabled={busy} onClick={() => dismissLegacy()} className="min-h-11 text-[13px] text-[#6B6455]">
            {t("Garder la famille actuelle")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
