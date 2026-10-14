"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { CapsuleItem } from "@/lib/types";

// Petits éléments des coffres du futur : la clé gravée, le compte à rebours, l'enregistreur de voix,
// le choix d'une vidéo (45 s au plus) et les icônes des objets.

/** La clé dorée, avec le code gravé sur l'anneau. */
export function CoffreKey({ code, size = 120, glow = true }: { code?: string; size?: number; glow?: boolean }) {
  return (
    <svg width={size * 2.2} height={size} viewBox="0 0 220 100" aria-hidden className="overflow-visible">
      <defs>
        <linearGradient id="or-cle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4DFA6" />
          <stop offset="0.45" stopColor="#C8A15A" />
          <stop offset="1" stopColor="#8A6A2E" />
        </linearGradient>
      </defs>
      {glow && <ellipse cx="60" cy="50" rx="58" ry="46" fill="rgba(255,214,150,0.18)" />}
      {/* Anneau */}
      <circle cx="56" cy="50" r="38" fill="url(#or-cle)" stroke="#6E4F1E" strokeWidth="2" />
      <circle cx="56" cy="50" r="25" fill="#12261A" stroke="#E6D3A3" strokeWidth="1.2" />
      <text x="56" y="57" textAnchor="middle" fontSize={code && code.length > 3 ? 17 : 21} fontFamily="Fraunces Variable, Georgia, serif" fill="#F4DFA6" letterSpacing="2">
        {code ?? "••••"}
      </text>
      {/* Tige et dents */}
      <rect x="92" y="44" width="110" height="12" rx="4" fill="url(#or-cle)" stroke="#6E4F1E" strokeWidth="1.5" />
      <path d="M170 56 v16 h10 v-9 h8 v13 h10 V56z" fill="url(#or-cle)" stroke="#6E4F1E" strokeWidth="1.5" />
      <circle cx="104" cy="50" r="2.4" fill="#6E4F1E" />
    </svg>
  );
}

/** Compte à rebours jusqu'au matin de la date d'ouverture. */
export function useCountdownTo(date: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const [y, m, d] = date.split("-").map(Number);
  const ms = Math.max(0, new Date(y, (m || 1) - 1, d || 1).getTime() - now);
  const days = Math.floor(ms / 86400000);
  return {
    done: ms === 0,
    years: Math.floor(days / 365.25),
    days: Math.floor(days - Math.floor(days / 365.25) * 365.25),
    hours: String(Math.floor((ms % 86400000) / 3600000)).padStart(2, "0"),
    minutes: String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0"),
    seconds: String(Math.floor((ms % 60000) / 1000)).padStart(2, "0"),
  };
}

export function Countdown({ date, small = false }: { date: string; small?: boolean }) {
  const t = useT();
  const c = useCountdownTo(date);
  const cells = [
    ...(c.years ? [{ v: c.years, l: t("ans") }] : []),
    { v: c.days, l: t("jours") },
    { v: `${c.hours}:${c.minutes}`, l: t("heures") },
    ...(small ? [] : [{ v: c.seconds, l: t("secondes") }]),
  ];
  return (
    <div className="flex justify-center gap-2" aria-live="off">
      {cells.map((x) => (
        <div key={x.l} className={`rounded-[14px] border border-or-pale/20 bg-coton/5 text-center ${small ? "min-w-[58px] px-1.5 py-1.5" : "min-w-[70px] px-2 py-3"}`}>
          <div className={`font-serif text-or-pale ${small ? "text-[18px]" : "text-[26px]"}`}>{x.v}</div>
          <div className="text-[10px] text-coton/70">{x.l}</div>
        </div>
      ))}
    </div>
  );
}

export const formatDate = (d: string, lang: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

const ICONS: Record<CapsuleItem["kind"], string> = {
  lettre: "M4 6h16v12H4zM4 7l8 6 8-6",
  document: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  photo: "M4 7h3l2-3h6l2 3h3v12H4zM12 10a3.5 3.5 0 100 7 3.5 3.5 0 000-7z",
  voix: "M9 3h6v11H9zM5 11a7 7 0 0014 0M12 18v3",
  video: "M3 7h12v10H3zM15 10l6-3v10l-6-3",
};
export function ItemIcon({ kind, size = 20, color = "#C8A15A" }: { kind: CapsuleItem["kind"]; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[kind]} />
    </svg>
  );
}

/** Enregistrer une note vocale (5 minutes au plus). */
export function VoiceRecorder({ onDone }: { onDone: (b: Blob, sec: number) => void }) {
  const t = useT();
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [sec, setSec] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(0);
  useEffect(() => {
    if (!rec) return;
    const i = setInterval(() => {
      const s = Math.floor((Date.now() - started.current) / 1000);
      setSec(s);
      if (s >= 300) rec.stop();
    }, 250);
    return () => clearInterval(i);
  }, [rec]);
  async function start() {
    setErr(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const r = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        s.getTracks().forEach((x) => x.stop());
        setRec(null);
        const b = new Blob(chunks, { type: (r.mimeType || "audio/webm").split(";")[0] });
        if (b.size) onDone(b, Math.max(1, Math.round((Date.now() - started.current) / 1000)));
      };
      started.current = Date.now();
      setSec(0);
      r.start(1000);
      setRec(r);
    } catch {
      setErr(t("Le micro n’est pas disponible. Autorisez-le dans les réglages du téléphone."));
    }
  }
  return (
    <div className="rounded-[18px] border border-or-pale/25 bg-coton/5 p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (rec ? rec.stop() : void start())}
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${rec ? "bg-terre" : "bg-or"}`}
          aria-label={rec ? t("Arrêter") : t("Enregistrer")}
        >
          {rec ? <span className="h-4 w-4 rounded-[3px] bg-coton" /> : <ItemIcon kind="voix" size={24} color="#12261A" />}
        </button>
        <div className="text-[13px] leading-snug text-coton/85">
          {rec ? (
            <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.4, repeat: Infinity }} className="text-or">
              {t("Enregistrement…")} {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}
            </motion.span>
          ) : (
            t("Touchez pour parler. Touchez encore pour terminer (5 minutes au plus).")
          )}
        </div>
      </div>
      {err && <p className="mt-2 text-[12px] text-terre">{err}</p>}
    </div>
  );
}

/** Durée d'une vidéo (en secondes), lue sans la jouer. */
export function videoDuration(file: Blob): Promise<number> {
  return new Promise((res) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      // Certains téléphones donnent « Infinity » tant que la vidéo n'a pas été parcourue.
      if (v.duration === Infinity) {
        v.currentTime = 1e7;
        v.ontimeupdate = () => {
          v.ontimeupdate = null;
          URL.revokeObjectURL(url);
          res(v.duration);
        };
      } else {
        URL.revokeObjectURL(url);
        res(v.duration);
      }
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      res(0);
    };
    v.src = url;
  });
}
