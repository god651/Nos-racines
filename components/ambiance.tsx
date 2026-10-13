"use client";

import { useEffect, useState } from "react";

// Éléments d'ambiance nostalgique partagés : grain de pellicule, poussière dorée, vignettage.

// Le grain est une petite tuile de bruit (160 px) calculée une seule fois puis répétée :
// bien plus léger qu'un filtre SVG recalculé à chaque image, même sur un téléphone d'entrée de gamme.
let grainTile: string | null = null;
function makeGrainTile() {
  if (grainTile || typeof document === "undefined") return grainTile;
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 96 + Math.random() * 64; // contraste doux : un grain de papier, pas de la neige
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainTile = c.toDataURL("image/png");
  return grainTile;
}

export function Grain({ opacity = 0.1, blend = "overlay" }: { opacity?: number; blend?: "overlay" | "multiply" }) {
  const [tile, setTile] = useState<string | null>(grainTile);
  useEffect(() => setTile(makeGrainTile()), []);
  if (!tile) return null;
  return (
    <div
      aria-hidden
      className="nr-grain pointer-events-none absolute -left-[10%] -top-[10%] h-[120%] w-[120%]"
      style={{ opacity, mixBlendMode: blend, backgroundImage: `url(${tile})`, backgroundSize: "160px 160px" }}
    />
  );
}

const DUST = [
  { left: 40, bottom: 120, size: 3, delay: 0, dur: 10 },
  { left: 110, bottom: 60, size: 2, delay: 2.5, dur: 12 },
  { left: 190, bottom: 200, size: 4, delay: 4, dur: 11 },
  { left: 260, bottom: 90, size: 2, delay: 1.2, dur: 9 },
  { left: 330, bottom: 160, size: 3, delay: 6, dur: 13 },
  { left: 80, bottom: 300, size: 2, delay: 7.5, dur: 10 },
  { left: 300, bottom: 330, size: 3, delay: 3.2, dur: 12 },
];

export function Dust({ color = "#E6D3A3" }: { color?: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {DUST.map((d, i) => (
        <span
          key={i}
          className="nr-dust absolute rounded-full"
          style={{
            left: d.left,
            bottom: d.bottom,
            width: d.size,
            height: d.size,
            background: i % 2 ? "#C8A15A" : color,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

export function Vignette({ glow = "rgba(200,161,90,0.15)", at = "50% 35%" }: { glow?: string; at?: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background: `radial-gradient(100% 70% at ${at}, ${glow}, rgba(0,0,0,0) 60%), radial-gradient(140% 100% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)`,
      }}
    />
  );
}
