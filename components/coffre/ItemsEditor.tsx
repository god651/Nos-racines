"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { shrinkImage } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import type { NewItem } from "@/lib/local/coffre";
import { ItemIcon, VoiceRecorder, videoDuration } from "./parts";

// Ce qu'on dépose dans le coffre : une lettre, un document scanné, des photos, une note vocale,
// une courte vidéo (45 secondes au plus).

const MAX_VIDEO_SEC = 45;
const MAX_VIDEO_MB = 30;
type Mode = "" | "lettre" | "voix";

export function ItemsEditor({ items, onChange }: { items: NewItem[]; onChange: (v: NewItem[]) => void }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("");
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const add = (it: NewItem) => {
    onChange([...items, it]);
    setMode("");
    setErr(null);
  };

  async function onFile(kind: "document" | "photo", f?: File) {
    if (!f) return;
    setBusy(true);
    try {
      // Les images sont allégées (lisibles, mais sans prendre trop de place) ; un PDF reste tel quel.
      const file = f.type.startsWith("image/") ? await shrinkImage(f, kind === "document" ? 2200 : 1800, 0.85) : f;
      if (file.size > 20 * 1024 * 1024) throw new Error(t("Fichier trop lourd (20 Mo au plus)."));
      add({ kind, file, name: f.name });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onVideo(f?: File) {
    if (!f) return;
    setBusy(true);
    setErr(null);
    try {
      const sec = await videoDuration(f);
      if (sec > MAX_VIDEO_SEC + 0.5) throw new Error(t("La vidéo dure {n} secondes : 45 secondes au plus.", { n: Math.round(sec) }));
      if (f.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error(t("Vidéo trop lourde ({n} Mo). Filmez en qualité plus basse (30 Mo au plus).", { n: Math.round(f.size / 1048576) }));
      add({ kind: "video", file: f, name: f.name, durationSec: Math.round(sec) || undefined });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const label = (it: NewItem) =>
    it.kind === "lettre"
      ? (it.text ?? "").slice(0, 60) + ((it.text ?? "").length > 60 ? "…" : "")
      : it.kind === "voix"
        ? t("Note vocale · {n} s", { n: it.durationSec ?? 0 })
        : it.kind === "video"
          ? t("Vidéo · {n} s", { n: it.durationSec ?? 0 })
          : it.name || (it.kind === "photo" ? t("Photo") : t("Document"));

  const BTN = [
    { k: "lettre", l: t("Lettre"), run: () => setMode(mode === "lettre" ? "" : "lettre") },
    { k: "document", l: t("Document scanné"), run: () => scanRef.current?.click() },
    { k: "photo", l: t("Photos"), run: () => photoRef.current?.click() },
    { k: "voix", l: t("Note vocale"), run: () => setMode(mode === "voix" ? "" : "voix") },
    { k: "video", l: t("Vidéo (45 s)"), run: () => videoRef.current?.click() },
  ] as const;

  return (
    <div>
      {items.length > 0 && (
        <ul className="mb-3 space-y-2">
          <AnimatePresence initial={false}>
            {items.map((it, i) => (
              <motion.li key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 rounded-[14px] border border-or-pale/20 bg-coton/5 px-3 py-2.5">
                <ItemIcon kind={it.kind} />
                <span className="min-w-0 flex-1 truncate text-[13px]">{label(it)}</span>
                <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={t("Retirer")} className="h-8 w-8 text-or-pale/70">
                  ✕
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <div className="grid grid-cols-3 gap-2">
        {BTN.map((b) => (
          <button key={b.k} type="button" disabled={busy} onClick={b.run} className={`flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-[16px] border text-[12px] ${mode === b.k ? "border-or bg-or/15" : "border-or-pale/25 bg-coton/5"}`}>
            <ItemIcon kind={b.k} size={22} />
            {b.l}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={() => docRef.current?.click()} className="flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-[16px] border border-or-pale/25 bg-coton/5 text-[12px]">
          <ItemIcon kind="document" size={22} />
          {t("Fichier (PDF…)")}
        </button>
      </div>
      {/* Le scanner ouvre directement l'appareil photo, dos au téléphone. */}
      <input ref={scanRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onFile("document", e.target.files?.[0]).then(() => (e.target.value = ""))} />
      <input ref={docRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => void onFile("document", e.target.files?.[0]).then(() => (e.target.value = ""))} />
      <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={async (e) => {
        for (const f of Array.from(e.target.files ?? []).slice(0, 10)) await onFile("photo", f);
        e.target.value = "";
      }} />
      <input ref={videoRef} type="file" accept="video/*" hidden onChange={(e) => void onVideo(e.target.files?.[0]).then(() => (e.target.value = ""))} />

      <AnimatePresence>
        {mode === "lettre" && (
          <motion.div key="l" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 overflow-hidden">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={20000} autoFocus placeholder={t("Ce que je veux que vous sachiez…")} className="w-full rounded-[16px] border border-or-pale/25 bg-coton/5 p-3.5 font-main text-[20px] leading-snug text-coton outline-none placeholder:text-or-pale/50 focus:border-or" />
            <button type="button" disabled={!text.trim()} onClick={() => (add({ kind: "lettre", text: text.trim() }), setText(""))} className="mt-2 min-h-11 w-full rounded-full border border-or text-[14px] text-or disabled:opacity-40">
              {t("Déposer la lettre")}
            </button>
          </motion.div>
        )}
        {mode === "voix" && (
          <motion.div key="v" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 overflow-hidden">
            <VoiceRecorder onDone={(b, sec) => add({ kind: "voix", file: b, durationSec: sec, name: "note-vocale" })} />
          </motion.div>
        )}
      </AnimatePresence>
      {busy && <p className="mt-2 text-[12px] text-or-pale">{t("Préparation…")}</p>}
      {err && <p className="mt-2 text-[12px] text-terre">{err}</p>}
    </div>
  );
}
