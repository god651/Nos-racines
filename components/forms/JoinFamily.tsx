"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Dust, Grain, Vignette } from "@/components/ambiance";
import { ErrorNote, Field, PrimaryButton } from "@/components/ui";
import { api } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import { sound } from "@/lib/sound";

export function JoinFamily({ token, familyName, valid, deviceLinkName, invalidText }: { token: string; familyName: string; valid: boolean; deviceLinkName?: string; invalidText: string }) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(valid ? null : invalidText);
  const started = useRef(false);

  async function join(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/rejoindre", "POST", { token, name });
      sound.play("success");
      router.replace("/accueil");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  // Lien d'appareil : pas de prénom à demander, on ouvre directement le compte.
  useEffect(() => {
    if (valid && deviceLinkName && !started.current) {
      started.current = true;
      void join();
    }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="relative flex min-h-dvh flex-col justify-center overflow-hidden bg-nuit px-7 text-coton">
      <Vignette />
      <Dust />
      <Grain />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative">
        <p className="font-serif text-sm tracking-[5px] text-or">NOS RACINES</p>
        <h1 className="mt-4 font-serif text-[32px] font-light leading-tight">
          {deviceLinkName ? t("Bonjour {nom}", { nom: deviceLinkName }) : t("Vous êtes invité(e)")}
        </h1>
        {familyName && <p className="mt-1 font-main text-2xl text-or-pale">{familyName}</p>}
        {!deviceLinkName && valid && (
          <form onSubmit={join} className="mt-7 flex flex-col gap-4 rounded-[24px] bg-coton p-5 text-ebene">
            <p className="text-sm leading-relaxed text-[#5A5A52]">
              {t("Vous pourrez voir l’arbre, les récits et les souvenirs. Seuls les administrateurs peuvent les modifier.")}
            </p>
            <Field label={t("Votre prénom")} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoFocus />
            <ErrorNote message={error} />
            <PrimaryButton type="submit" loading={busy}>{t("Rejoindre la famille")}</PrimaryButton>
          </form>
        )}
        {(deviceLinkName || !valid) && (
          <div className="mt-6">
            {busy && <p className="text-or-pale">{t("Ouverture de votre compte…")}</p>}
            <ErrorNote message={error} />
          </div>
        )}
      </motion.div>
    </main>
  );
}
