"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Dust, Grain, Vignette } from "@/components/ambiance";
import { ErrorNote, Field, PrimaryButton } from "@/components/ui";
import { api } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import { sound } from "@/lib/sound";
import { importFamily, joinFromCloud } from "@/lib/local/backup";
import { getLink, joinCloud } from "@/lib/local/sync";

export function JoinFamily({ token, familyName, valid, deviceLinkName, invalidText, hasFamily = true, needsName = true, cloud, known = true }: { known?: boolean; token: string; familyName: string; valid: boolean; deviceLinkName?: string; invalidText: string; hasFamily?: boolean; needsName?: boolean; cloud?: { fid: string; key: string } }) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // Un code inconnu de ce téléphone n'est pas « périmé » : il vient d'un autre téléphone.
  const foreign = hasFamily && !valid && !known && !cloud;
  const [error, setError] = useState<string | null>(valid || !hasFamily || foreign ? null : invalidText);
  const fileRef = useRef<HTMLInputElement>(null);

  // Nouveau téléphone relié au partage en direct : toute la famille arrive par Internet.
  async function fromCloud() {
    if (!cloud) return;
    setBusy(true);
    setError(null);
    try {
      await joinFromCloud(cloud, token, name.trim() || undefined);
      sound.play("success");
      router.replace("/accueil");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  // Ce téléphone a déjà la famille (ancienne sauvegarde) mais pas encore le partage : on le relie d'abord.
  const linking = useRef(false);
  useEffect(() => {
    if (!hasFamily || !cloud || getLink() || linking.current) return;
    linking.current = true;
    void joinCloud(cloud).then(() => router.refresh()).catch(() => undefined);
  }, [hasFamily, cloud, router]);

  // Nouveau téléphone : la famille arrive par la sauvegarde envoyée par un administrateur.
  async function fromBackup(f: File) {
    setBusy(true);
    setError(null);
    try {
      await importFamily(f, { token, name: name.trim() || undefined });
      sound.play("success");
      router.replace("/accueil");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
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
        {hasFamily && !deviceLinkName && valid && (
          <form onSubmit={join} className="mt-7 flex flex-col gap-4 rounded-[24px] bg-coton p-5 text-ebene">
            <p className="text-sm leading-relaxed text-[#5A5A52]">
              {t("Vous pourrez voir l’arbre, les récits et les souvenirs. Seuls les administrateurs peuvent les modifier.")}
            </p>
            <Field label={t("Votre prénom")} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoFocus />
            <ErrorNote message={error} />
            <PrimaryButton type="submit" loading={busy}>{t("Rejoindre la famille")}</PrimaryButton>
          </form>
        )}
        {!hasFamily && cloud && (
          <div className="mt-7 flex flex-col gap-4 rounded-[24px] bg-coton p-5 text-ebene">
            <p className="text-sm leading-relaxed text-[#5A5A52]">
              {t("Bienvenue ! L’arbre, les photos, les voix et les hommages vont arriver sur ce téléphone. Il faut Internet pour cette première fois.")}
            </p>
            {needsName && <Field label={t("Votre prénom")} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />}
            <ErrorNote message={error} />
            <PrimaryButton type="button" loading={busy} disabled={needsName && !name.trim()} onClick={() => void fromCloud()}>
              {t("Recevoir la famille")}
            </PrimaryButton>
          </div>
        )}
        {!hasFamily && !cloud && (
          <div className="mt-7 flex flex-col gap-4 rounded-[24px] bg-coton p-5 text-ebene">
            <p className="text-sm leading-relaxed text-[#5A5A52]">
              {t("Bienvenue ! Pour recevoir l’arbre, les photos et les voix, demandez à un administrateur de la famille de vous envoyer la sauvegarde (Paramètres › Sauvegarde, par WhatsApp par exemple), puis ouvrez-la ici.")}
            </p>
            {needsName && <Field label={t("Votre prénom")} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />}
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && void fromBackup(e.target.files[0])} />
            <ErrorNote message={error} />
            <PrimaryButton type="button" loading={busy} disabled={needsName && !name.trim()} onClick={() => fileRef.current?.click()}>
              {t("Ouvrir la sauvegarde reçue")}
            </PrimaryButton>
          </div>
        )}
        {foreign && (
          <div className="mt-7 flex flex-col gap-4 rounded-[24px] bg-coton p-5 text-ebene">
            <p className="text-sm leading-relaxed text-[#5A5A52]">
              {t("Ce QR code vient d’un autre téléphone : la famille qu’il ouvre n’est pas encore sur celui-ci. Demandez à la personne qui vous l’a montré de vous envoyer sa sauvegarde (Paramètres › Sauvegarde › Envoyer une copie), puis ouvrez-la ici. Avec le partage en direct, tout arrivera seul en scannant.")}
            </p>
            {needsName && <Field label={t("Votre prénom")} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />}
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && void fromBackup(e.target.files[0])} />
            <ErrorNote message={error} />
            <PrimaryButton type="button" loading={busy} disabled={needsName && !name.trim()} onClick={() => fileRef.current?.click()}>
              {t("Ouvrir la sauvegarde reçue")}
            </PrimaryButton>
            <p className="text-[11px] leading-snug text-[#8A3A26]">{t("Attention : la famille qui est sur ce téléphone sera remplacée. Faites d’abord sa sauvegarde si vous voulez la garder.")}</p>
          </div>
        )}
        {hasFamily && !foreign && (deviceLinkName || !valid) && (
          <div className="mt-6">
            {busy && <p className="text-or-pale">{t("Ouverture de votre compte…")}</p>}
            <ErrorNote message={error} />
          </div>
        )}
      </motion.div>
    </main>
  );
}
