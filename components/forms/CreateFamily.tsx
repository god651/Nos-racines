"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Dust, Grain, Vignette } from "@/components/ambiance";
import { ErrorNote, Field, GhostButton, PrimaryButton, Toggle } from "@/components/ui";
import { api } from "@/lib/client";
import { importFamily } from "@/lib/local/backup";
import { findPhoneBackup } from "@/lib/local/backup-finder";
import { cloudAvailable, enableSharing } from "@/lib/local/sync";
import { askConfirm } from "@/components/Confirm";
import { decorateDemo } from "@/lib/local/demo";
import { useT } from "@/lib/i18n/client";
import { sound } from "@/lib/sound";

export function CreateFamily() {
  const t = useT();
  const router = useRouter();
  const [f, setF] = useState({ name: "", village: "", motto: "", since: "", userName: "", userFamilyName: "", sex: "m", birthYear: "" });
  const [addSelf, setAddSelf] = useState(true);
  const [busy, setBusy] = useState<"create" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    try {
      await api("/api/famille", "POST", { ...f, addSelf });
      // Famille en ligne : elle est aussitôt créée dans la base centrale (vous en êtes l'administrateur principal).
      if (cloudAvailable) await enableSharing();
      sound.play("success");
      router.replace("/accueil");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  const restoreInput = useRef<HTMLInputElement>(null);

  async function demo() {
    setBusy("demo");
    setError(null);
    try {
      await api("/api/famille/exemple", "POST", { userName: f.userName || undefined });
      await decorateDemo();
      router.replace("/accueil");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-nuit px-6 pb-10 pt-14 text-coton">
      <Vignette />
      <Dust />
      <Grain />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }} className="relative">
        <p className="font-serif text-sm tracking-[5px] text-or">NOS RACINES</p>
        <h1 className="mt-4 font-serif text-[34px] font-light leading-tight">{t("Plantons votre arbre")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-or-pale">
          {cloudAvailable ? t("Un seul arbre pour toute la famille, en ligne : chaque membre voit et complète le même. Vous serez l’administrateur principal.") : t("Tout reste dans ce téléphone. Vous serez le premier administrateur.")}
        </p>
      </motion.div>

      <motion.form
        onSubmit={create}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.9 }}
        className="relative mt-7 flex flex-col gap-4 rounded-[24px] bg-coton p-5 text-ebene shadow-doux"
      >
        <h2 className="font-serif text-xl text-nuit">{t("La famille")}</h2>
        <Field label={t("Nom de la famille")} placeholder={t("Ex. Famille Kouassi")} value={f.name} onChange={set("name")} required maxLength={80} />
        <Field label={t("Village d’origine")} placeholder={t("Ex. Sakassou")} value={f.village} onChange={set("village")} maxLength={80} />
        <Field label={t("Devise de la famille (facultatif)")} placeholder={t("Ex. Ce que nous sommes, ils le sauront")} value={f.motto} onChange={set("motto")} maxLength={140} />
        <Field label={t("Depuis (année, facultatif)")} inputMode="numeric" placeholder="1921" value={f.since} onChange={set("since")} />

        <h2 className="mt-2 font-serif text-xl text-nuit">{t("Vous")}</h2>
        <Field label={t("Votre prénom")} value={f.userName} onChange={set("userName")} required maxLength={60} autoComplete="given-name" />
        <Toggle label={t("M’ajouter dans l’arbre")} hint={t("Votre fiche sera le point de départ de l’arbre.")} checked={addSelf} onChange={setAddSelf} />
        {addSelf && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Nom de famille")} value={f.userFamilyName} onChange={set("userFamilyName")} maxLength={60} autoComplete="family-name" />
            <Field label={t("Année de naissance")} inputMode="numeric" value={f.birthYear} onChange={set("birthYear")} />
            <div className="col-span-2 flex gap-2" role="group" aria-label={t("Sexe")}>
              {[
                ["m", t("Homme")],
                ["f", t("Femme")],
              ].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setF({ ...f, sex: v })} aria-pressed={f.sex === v} className={`min-h-11 flex-1 rounded-full border text-sm ${f.sex === v ? "border-foret bg-foret text-coton" : "border-or-pale text-foret"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
        <ErrorNote message={error} />
        <PrimaryButton type="submit" loading={busy === "create"} disabled={!!busy}>
          {t("Créer notre famille")}
        </PrimaryButton>
      </motion.form>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="relative mt-6 text-center">
        {!cloudAvailable && (
          <>
            <p className="mb-3 text-sm text-or-pale">{t("Vous voulez d’abord découvrir l’application ?")}</p>
            <GhostButton onClick={demo} disabled={!!busy} className="mx-auto border-or-pale/50 text-or-pale">
              {busy === "demo" ? "…" : t("Explorer avec une famille d’exemple")}
            </GhostButton>
          </>
        )}
        <input
          ref={restoreInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy("demo");
            setError(null);
            try {
              await importFamily(file);
              if (cloudAvailable) await enableSharing().catch(() => undefined);
              router.replace("/accueil");
            } catch (err) {
              setError((err as Error).message);
              setBusy(null);
            }
          }}
        />
        <button
          type="button"
          onClick={async () => {
            // On cherche d'abord la sauvegarde du téléphone (Documents › NosRacines) ; sinon, le sélecteur de fichiers.
            const found = await findPhoneBackup();
            if (found && (await askConfirm(t("Sauvegarde trouvée : {nom}, du {date}. La restaurer ?", { nom: found.familyName, date: new Date(found.date).toLocaleDateString() })))) {
              setBusy("demo");
              setError(null);
              try {
                await importFamily(found.file);
                if (cloudAvailable) await enableSharing().catch(() => undefined);
                router.replace("/accueil");
              } catch (err) {
                setError((err as Error).message);
                setBusy(null);
              }
              return;
            }
            restoreInput.current?.click();
          }}
          disabled={!!busy}
          className="mt-4 text-[13px] text-or-pale/80 underline underline-offset-4"
        >
          {t("Restaurer une sauvegarde")}
        </button>
        <p className="mx-auto mt-1 max-w-[300px] text-[11px] leading-snug text-or-pale/55">{t("Le fichier se trouve dans Documents › NosRacines du téléphone, ou là où vous l’avez envoyé.")}</p>
      </motion.div>
    </main>
  );
}
