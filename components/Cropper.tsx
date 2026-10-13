"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

// Recadrage d'une photo avant l'envoi : on déplace au doigt, on zoome (pincement ou curseur),
// le cadre montre exactement ce qui sera gardé.

type Req = { file: Blob; aspect: number; round: boolean; resolve: (b: Blob | null) => void };
let open: ((r: Req | null) => void) | null = null;

/** Ouvre la fenêtre de cadrage ; renvoie la photo recadrée (ou null si annulé). */
export function cropImage(file: Blob, opts: { aspect?: number; round?: boolean } = {}): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!open) return resolve(file);
    open({ file, aspect: opts.aspect ?? 1, round: opts.round ?? true, resolve });
  });
}

const FRAME = 280; // largeur du cadre à l'écran
const OUT = 1200; // largeur de la photo gardée

export function CropHost() {
  const t = useT();
  const [req, setReq] = useState<Req | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [url, setUrl] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);

  useEffect(() => {
    open = setReq;
    return () => {
      open = null;
    };
  }, []);

  useEffect(() => {
    if (!req) return;
    const u = URL.createObjectURL(req.file);
    const im = new Image();
    im.onload = () => {
      setImg(im);
      setZoom(1);
      // Les visages sont presque toujours dans le haut de la photo : on part du haut.
      const fh0 = FRAME / req.aspect;
      const b0 = Math.max(FRAME / im.naturalWidth, fh0 / im.naturalHeight);
      const h0 = im.naturalHeight * b0;
      setPos({ x: 0, y: ((h0 - fh0) / 2) * 0.85 });
    };
    im.onerror = () => {
      req.resolve(req.file);
      setReq(null);
    };
    im.src = u;
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [req]);

  if (!req) return null;
  const fw = FRAME;
  const fh = FRAME / req.aspect;
  // Échelle de base : l'image couvre tout le cadre.
  const base = img ? Math.max(fw / img.naturalWidth, fh / img.naturalHeight) : 1;
  const s = base * zoom;
  const w = img ? img.naturalWidth * s : fw;
  const h = img ? img.naturalHeight * s : fh;
  // On empêche de laisser du vide dans le cadre.
  const clamp = (p: { x: number; y: number }) => ({
    x: Math.min((w - fw) / 2, Math.max(-(w - fw) / 2, p.x)),
    y: Math.min((h - fh) / 2, Math.max(-(h - fh) / 2, p.y)),
  });
  const cpos = clamp(pos);

  // Zoom en gardant le même point au centre du cadre.
  const zoomTo = (z: number) => {
    setPos((p) => ({ x: (p.x * z) / zoom, y: (p.y * z) / zoom }));
    setZoom(z);
  };

  const close = (b: Blob | null) => {
    req.resolve(b);
    setReq(null);
    setImg(null);
  };

  const confirm = () => {
    if (!img) return close(req.file);
    const c = document.createElement("canvas");
    c.width = OUT;
    c.height = Math.round(OUT / req.aspect);
    const g = c.getContext("2d")!;
    // Coin haut-gauche du cadre, en coordonnées de l'image.
    const sx = (w / 2 - fw / 2 - cpos.x) / s;
    const sy = (h / 2 - fh / 2 - cpos.y) / s;
    g.drawImage(img, sx, sy, fw / s, fh / s, 0, 0, c.width, c.height);
    c.toBlob((b) => close(b ?? req.file), "image/jpeg", 0.88);
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom };
      drag.current = null;
    } else drag.current = { x: e.clientX, y: e.clientY, px: cpos.x, py: cpos.y };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      zoomTo(Math.min(4, Math.max(1, (pinch.current.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.d)));
    } else if (drag.current) {
      setPos(clamp({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }));
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!pointers.current.size) drag.current = null;
  };

  return (
    <AnimatePresence>
      <motion.div key="crop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[75] flex flex-col items-center justify-center bg-[#0B1711]/95 px-5 text-coton backdrop-blur-sm">
        <p className="font-serif text-[22px]">{t("Cadrer la photo")}</p>
        <p className="mt-1 text-[13px] text-or-pale">{t("Faites glisser pour placer le visage, pincez ou utilisez le curseur pour zoomer.")}</p>
        <div
          className="relative mt-6 touch-none select-none overflow-hidden bg-black/40"
          style={{ width: fw, height: fh, borderRadius: req.round ? "50%" : 18 }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{ width: w, height: h, left: (fw - w) / 2 + cpos.x, top: (fh - h) / 2 + cpos.y }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 border-2 border-or/80" style={{ borderRadius: req.round ? "50%" : 18 }} />
          {/* Repères des tiers pour aider à centrer le visage */}
          <div className="pointer-events-none absolute inset-0 opacity-30">
            <span className="absolute inset-y-0 left-1/3 w-px bg-coton" />
            <span className="absolute inset-y-0 left-2/3 w-px bg-coton" />
            <span className="absolute inset-x-0 top-1/3 h-px bg-coton" />
            <span className="absolute inset-x-0 top-2/3 h-px bg-coton" />
          </div>
        </div>
        <label className="mt-6 flex w-full max-w-[300px] items-center gap-3">
          <span className="text-or-pale">−</span>
          <input type="range" min={100} max={400} value={Math.round(zoom * 100)} onChange={(e) => zoomTo(Number(e.target.value) / 100)} className="flex-1 accent-[#C8A15A]" aria-label={t("Zoom")} />
          <span className="text-or-pale">+</span>
        </label>
        <div className="mt-6 flex w-full max-w-[320px] gap-2">
          <button onClick={() => close(req.file)} className="min-h-12 flex-1 rounded-full border border-or/50 text-sm text-or-pale">{t("Sans recadrer")}</button>
          <button onClick={confirm} className="min-h-12 flex-1 rounded-full bg-or text-sm font-semibold text-nuit">{t("Valider le cadrage")}</button>
        </div>
        <button onClick={() => close(null)} className="mt-3 text-[13px] text-or-pale/70 underline">{t("Annuler")}</button>
      </motion.div>
    </AnimatePresence>
  );
}
