"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import { sound } from "@/lib/sound";
import { Area, ErrorNote, Field, PageHeader, PrimaryButton, Toggle } from "../ui";
import type { PersonOption } from "./PersonForm";
import { PhotoPicker } from "./PhotoPicker";

export function MemoryForm({ options, preselected, backHref, covers }: { options: PersonOption[]; preselected: string[]; backHref: string; covers: string[] }) {
  const t = useT();
  const router = useRouter();
  const [photoId, setPhotoId] = useState<string>();
  const [caption, setCaption] = useState("");
  const [year, setYear] = useState("");
  const [people, setPeople] = useState<string[]>(preselected);
  const [asCover, setAsCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/souvenirs", "POST", { photoId, caption, year, personIds: people });
      if (asCover && photoId) await api("/api/famille", "PATCH", { covers: [...covers, photoId] });
      sound.play("success");
      router.replace(backHref);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-kapok pb-10">
      <PageHeader back={backHref} kicker={t("un moment à garder")} title={t("Ajouter un souvenir")} />
      <form onSubmit={save} className="flex flex-col gap-4 px-4">
        <section className="flex flex-col gap-4 rounded-[20px] border border-or-pale/70 bg-white/70 p-4 shadow-doux">
          <PhotoPicker value={photoId} onChange={setPhotoId} round={false} label={t("Choisir la photo du souvenir")} />
          <Area label={t("Légende")} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder={t("Ex. Le mariage de Papa Yao, devant la grande cour")} />
          <Field label={t("Année (même approximative)")} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="1974" />
          {photoId && <Toggle label={t("Ajouter aussi au diaporama de l’accueil")} hint={t("La photo défilera en couverture de l’application.")} checked={asCover} onChange={setAsCover} />}
        </section>

        {options.length > 0 && (
          <section className="rounded-[20px] border border-or-pale/70 bg-white/70 p-4 shadow-doux">
            <p className="mb-3 text-[13px] font-medium text-foret">{t("Qui est sur ce souvenir ?")}</p>
            <div className="flex flex-wrap gap-2">
              {options.map((o) => {
                const on = people.includes(o.id);
                return (
                  <button key={o.id} type="button" aria-pressed={on} onClick={() => setPeople(on ? people.filter((x) => x !== o.id) : [...people, o.id])} className={`min-h-10 rounded-full border px-3.5 text-[13px] ${on ? "border-foret bg-foret text-coton" : "border-or-pale bg-coton text-foret"}`}>
                    {o.name}
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <ErrorNote message={error} />
        <PrimaryButton type="submit" loading={busy} disabled={!photoId && !caption.trim()}>
          {t("Garder ce souvenir")}
        </PrimaryButton>
      </form>
    </main>
  );
}
