"use client";

import { AnimatePresence, motion, type MotionValue } from "framer-motion";
import { useEffect, useState } from "react";
import { mediaUrl } from "@/lib/client";

// Diaporama de couverture : fondu enchaîné lent, léger zoom et dérive (effet « Ken Burns »),
// teinte chaude pour que chaque photo se fonde dans le décor sépia de l'application.

const MOVES = [
  { from: { scale: 1.16, x: "-3%", y: "2%" }, to: { scale: 1.02, x: "0%", y: "0%" } },
  { from: { scale: 1.04, x: "2%", y: "-1%" }, to: { scale: 1.16, x: "-2%", y: "2%" } },
  { from: { scale: 1.14, x: "2%", y: "3%" }, to: { scale: 1.03, x: "-1%", y: "-1%" } },
  { from: { scale: 1.03, x: "-2%", y: "-2%" }, to: { scale: 1.15, x: "2%", y: "1%" } },
];
const SLIDE = 7000;

export function CoverSlideshow({ ids, px, py }: { ids: string[]; px?: MotionValue<number>; py?: MotionValue<number> }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (ids.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % ids.length), SLIDE);
    return () => clearInterval(t);
  }, [ids.length]);

  // Précharge la photo suivante pour un enchaînement sans à-coup.
  useEffect(() => {
    if (ids.length < 2) return;
    const img = new Image();
    img.src = mediaUrl(ids[(i + 1) % ids.length])!;
  }, [i, ids]);

  if (!ids.length) return null;
  const move = MOVES[i % MOVES.length];
  return (
    <motion.div className="absolute inset-[-4%]" style={{ x: px, y: py }}>
      <AnimatePresence initial={false}>
        <motion.div key={`${ids[i]}-${i}`} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.8, ease: "easeInOut" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            src={mediaUrl(ids[i])}
            alt=""
            className="h-full w-full object-cover"
            style={{ filter: "sepia(.35) saturate(.85) contrast(1.05) brightness(.82)" }}
            initial={move.from}
            animate={move.to}
            transition={{ duration: (SLIDE + 1800) / 1000, ease: "linear" }}
          />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
