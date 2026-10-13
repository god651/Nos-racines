"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { mediaUrl, uploadPhoto } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import { ErrorNote } from "../ui";
import { cropImage } from "../Cropper";

/** Choix d'une photo : appareil photo ou galerie, allégée puis envoyée à l'ordinateur de la famille. */
export function PhotoPicker({ value, onChange, isPublic = false, round = true, label }: { value?: string; onChange: (id: string | undefined) => void; isPublic?: boolean; round?: boolean; label?: string }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      const cropped = await cropImage(f, { aspect: round ? 1 : 4 / 3, round });
      if (!cropped) return;
      const { id } = await uploadPhoto(cropped, isPublic);
      onChange(id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label={label ?? t("Choisir une photo")}
        className={`relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border-2 border-dashed border-or bg-or/10 ${round ? "rounded-full" : "rounded-[16px]"}`}
      >
        <AnimatePresence mode="wait">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <motion.img key={value} src={mediaUrl(value)} alt="" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <motion.svg key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#8A6A2E" strokeWidth="1.6" aria-hidden>
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </motion.svg>
          )}
        </AnimatePresence>
        {busy && <motion.span className="absolute inset-0 bg-nuit/40" animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} />}
      </button>
      <div className="flex flex-col items-start gap-1.5 text-sm">
        <button type="button" onClick={() => input.current?.click()} className="font-semibold text-foret underline-offset-2 hover:underline">
          {value ? t("Changer la photo") : t("Ajouter une photo")}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(undefined)} className="text-[#8A3A26]">
            {t("Retirer")}
          </button>
        )}
        <ErrorNote message={error} />
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  );
}
