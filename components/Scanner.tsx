"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { navigate } from "@/lib/local/router";
import { read } from "@/lib/local/store-core";
import { openExternal } from "@/lib/native";
import { decodeShared } from "@/lib/share-code";
import { sound } from "@/lib/sound";

// Scanner de QR codes de l'application : fiches, arbres et invitations « Rejoindre la famille »
// (ces dernières ne s'ouvrent qu'ici). La caméra s'allume seulement pendant le scan.

let openFn: (() => void) | null = null;
export const openScanner = () => openFn?.();

type BD = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

export function ScanHost() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unknown, setUnknown] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    openFn = () => {
      setError(null);
      setUnknown(null);
      setOpen(true);
    };
    return () => {
      openFn = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    let detector: BD | null = null;
    try {
      const B = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BD }).BarcodeDetector;
      if (B) detector = new B({ formats: ["qr_code"] });
    } catch {}
    let jsqr: ((d: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null = null;

    const found = (text: string) => {
      stop = true;
      sound.play("chime");
      try {
        navigator.vibrate?.(40);
      } catch {}
      const d = decodeShared(text);
      if (d.kind === "join") {
        setOpen(false);
        navigate(`/rejoindre/${encodeURIComponent(d.token)}`);
      } else if (d.kind === "person") {
        setOpen(false);
        // La personne est déjà dans la famille de ce téléphone : on ouvre sa vraie fiche.
        const local = read().persons.find((p) => p.qrCode && p.qrCode === d.card.code);
        if (local && read().family) navigate(`/membre/${local.id}`);
        else navigate(`/voir?d=${encodeURIComponent(text.slice(text.indexOf("#") + 1))}`);
      } else if (d.kind === "tree") {
        setOpen(false);
        navigate(`/voir?d=${encodeURIComponent(text.slice(text.indexOf("#") + 1))}`);
      } else setUnknown(d.text);
    };

    const tick = async () => {
      if (stop) return;
      const v = video.current;
      if (v && v.readyState >= 2 && v.videoWidth) {
        try {
          if (detector) {
            const r = await detector.detect(v);
            if (r[0]?.rawValue) return found(r[0].rawValue);
          } else {
            const w = 480;
            const h = Math.round((v.videoHeight / v.videoWidth) * w);
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(v, 0, 0, w, h);
            if (!jsqr) jsqr = (await import("jsqr")).default as unknown as typeof jsqr;
            const r = jsqr!(ctx.getImageData(0, 0, w, h).data, w, h);
            if (r?.data) return found(r.data);
          }
        } catch {
          detector = null;
        }
      }
      timer = setTimeout(() => void tick(), 180);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
        if (stop) return stream.getTracks().forEach((x) => x.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => undefined);
        }
        void tick();
      } catch {
        setError(t("La caméra n’est pas disponible. Autorisez l’accès à l’appareil photo pour Nos Racines dans les réglages du téléphone, puis réessayez."));
      }
    })();
    return () => {
      stop = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((x) => x.stop());
    };
  }, [open, t]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[74] flex flex-col bg-black text-coton">
          <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
          {/* Voile percé au centre : le cadre à viser. */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[250px] w-[250px] rounded-[28px]" style={{ boxShadow: "0 0 0 9999px rgba(8,16,11,0.62)" }}>
              {["left-0 top-0 border-l-4 border-t-4 rounded-tl-[28px]", "right-0 top-0 border-r-4 border-t-4 rounded-tr-[28px]", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-[28px]", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-[28px]"].map((c) => (
                <span key={c} className={`absolute h-12 w-12 border-or ${c}`} />
              ))}
              <motion.span className="absolute inset-x-5 h-[2px] rounded-full bg-or/80 shadow-[0_0_14px_#C8A15A]" animate={{ top: ["12%", "88%", "12%"] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} />
            </div>
          </div>
          <div className="relative px-6 pt-[max(48px,env(safe-area-inset-top))] text-center">
            <p className="font-serif text-xs tracking-[5px] text-or">NOS RACINES</p>
            <p className="mt-2 font-serif text-[24px]">{t("Scanner un QR code")}</p>
            <p className="mt-1 text-[13px] text-or-pale">{t("Visez le QR code d’un portrait, d’un arbre ou d’une invitation.")}</p>
          </div>
          <div className="relative mt-auto px-6 pb-[max(28px,env(safe-area-inset-bottom))]">
            {error && <p className="mb-3 rounded-[16px] bg-terre/90 p-3 text-center text-[13px] leading-snug">{error}</p>}
            {unknown && (
              <div className="mb-3 rounded-[18px] bg-coton p-4 text-ebene">
                <p className="text-[13px] text-[#6B6455]">{t("Ce QR code ne vient pas de Nos Racines.")}</p>
                <p className="mt-1 break-all text-[13px]">{unknown.slice(0, 200)}</p>
                <div className="mt-3 flex gap-2">
                  {/^https?:\/\//.test(unknown) && (
                    <button onClick={() => openExternal(unknown)} className="min-h-10 flex-1 rounded-full bg-foret text-[13px] font-semibold text-coton">
                      {t("Ouvrir le lien")}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setOpen(false);
                      setTimeout(() => openFn?.(), 50);
                    }}
                    className="min-h-10 flex-1 rounded-full border border-or text-[13px] text-foret"
                  >
                    {t("Scanner un autre")}
                  </button>
                </div>
              </div>
            )}
            <button onClick={() => setOpen(false)} className="min-h-12 w-full rounded-full border border-or/60 bg-black/40 text-[15px] text-coton backdrop-blur">
              {t("Fermer")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Bouton « Scanner » (icône QR). */
export function ScanButton({ className = "", label }: { className?: string; label?: string }) {
  const t = useT();
  return (
    <button onClick={openScanner} aria-label={t("Scanner un QR code")} className={className}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16" />
      </svg>
      {label && <span>{label}</span>}
    </button>
  );
}
