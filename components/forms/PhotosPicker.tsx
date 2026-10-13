"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { mediaUrl, uploadPhoto } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import { ErrorNote } from "../ui";
import { cropImage } from "../Cropper";

/** Jusqu'à 3 photos par personne ; la première est le portrait de l'arbre. */
export function PhotosPicker({ value, onChange, isPublic = false, max = 3 }: { value: string[]; onChange: (ids: string[]) => void; isPublic?: boolean; max?: number }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])].slice(0, max - value.length);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError(null);
    const ids = [...value];
    for (const f of files) {
      try {
        // Cadrage : le portrait (1re photo) en rond, les autres en format photo.
        const first = ids.length === 0;
        const cropped = await cropImage(f, { aspect: first ? 1 : 4 / 5, round: first });
        if (!cropped) continue;
        ids.push((await uploadPhoto(cropped, isPublic)).id);
      } catch (err) {
        setError((err as Error).message);
      }
    }
    onChange(ids.slice(0, max));
    setBusy(false);
  }

  return (
    <div>
      <div className="flex gap-3">
        <AnimatePresence initial={false}>
          {value.map((id, i) => (
            <motion.div key={id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(id)} alt="" className={`h-[86px] w-[86px] object-cover ${i === 0 ? "rounded-full ring-2 ring-or ring-offset-2 ring-offset-coton" : "rounded-[16px]"}`} />
              <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={t("Retirer")} className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-coton text-[#8A3A26] shadow">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
              {i > 0 && (
                <button type="button" onClick={() => onChange([id, ...value.filter((x) => x !== id)])} className="absolute inset-x-0 -bottom-5 text-center text-[10px] text-or-fonce underline">
                  {t("Portrait")}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {value.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            aria-label={t("Ajouter une photo")}
            className={`relative flex h-[86px] w-[86px] shrink-0 flex-col items-center justify-center gap-1 overflow-hidden border-2 border-dashed border-or bg-or/10 text-[11px] text-or-fonce ${value.length ? "rounded-[16px]" : "rounded-full"}`}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8A6A2E" strokeWidth="1.6" aria-hidden>
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {value.length}/{max}
            {busy && <motion.span className="absolute inset-0 bg-nuit/40" animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} />}
          </button>
        )}
      </div>
      <p className="mt-6 text-xs text-[#6B6455]">{t("Jusqu’à 3 photos. La première sert de portrait dans l’arbre.")}</p>
      <ErrorNote message={error} />
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={pick} />
    </div>
  );
}
