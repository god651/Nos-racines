"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { recoverAccount } from "@/lib/local/backup";
import { cloudAvailable } from "@/lib/local/sync";
import { sound } from "@/lib/sound";
import { ErrorNote } from "../ui";

/** « Reprendre avec mon code » : nouveau téléphone ou réinstallation, on retrouve tout. */
export function RecoverEntry() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!cloudAvailable) return null;
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (
    <div className="mt-3">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-[13px] text-or-pale/80 underline underline-offset-4">
          {t("Reprendre avec mon code de reprise")}
        </button>
      ) : (
        <AnimatePresence>
          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mt-2 max-w-[340px] rounded-[20px] border border-or/40 bg-coton/5 p-4 text-left"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await recoverAccount(clean);
                sound.play("success");
                router.replace("/accueil");
              } catch (err) {
                setError((err as Error).message);
                setBusy(false);
              }
            }}
          >
            <p className="text-[13px] leading-relaxed text-or-pale">{t("Tapez le code de reprise noté dans Paramètres › Sauvegarde. La famille et votre compte reviennent tels que vous les aviez laissés. Il faut Internet.")}</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABCD-EFGH-JKLM-NPQR"
              autoCapitalize="characters"
              autoComplete="off"
              className="mt-3 w-full rounded-[14px] border border-or-pale/30 bg-coton/10 px-3 py-3 text-center font-serif text-[18px] tracking-[2px] text-coton outline-none placeholder:text-or-pale/40 focus:border-or"
            />
            <ErrorNote message={error} />
            <button type="submit" disabled={busy || clean.length < 16} className="mt-3 min-h-12 w-full rounded-full bg-or text-[14px] font-semibold text-nuit disabled:opacity-40">
              {busy ? "…" : t("Reprendre")}
            </button>
          </motion.form>
        </AnimatePresence>
      )}
    </div>
  );
}
