"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { sound } from "@/lib/sound";

// Branche le paysage sonore sur toute l'application :
// - premier geste de l'utilisateur → l'ambiance de forêt entre en fondu ;
// - chaque bouton ou lien touché → petit froissement de feuille ;
// - chaque changement de page → souffle de feuilles ;
// - un bouton discret permet de couper ou remettre le son à tout moment.

export function SoundLayer() {
  const path = usePathname();
  const t = useT();
  const [on, setOn] = useState(true);
  const [started, setStarted] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    setOn(sound.enabled);
    const off = sound.onChange(setOn);
    const unlock = () => {
      void sound.unlock();
      setStarted(true);
    };
    const tap = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest("button, a, [role=tab]");
      if (el && !el.hasAttribute("data-silent")) sound.play("tap");
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("pointerdown", tap);
    return () => {
      off();
      window.removeEventListener("pointerdown", tap);
    };
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    sound.play("whoosh");
  }, [path]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto flex max-w-[440px] justify-end px-3 pt-3">
      <button
        data-silent
        onClick={() => sound.setEnabled(!on)}
        aria-label={on ? t("Couper l’ambiance sonore") : t("Activer l’ambiance sonore")}
        aria-pressed={on}
        className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full border border-or-pale/30 bg-nuit/55 px-3 text-[11px] text-or-pale backdrop-blur-md"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E6D3A3" strokeWidth="1.8" aria-hidden>
          <path d="M4 9v6h4l5 4V5L8 9z" />
          {on ? <path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" /> : <path d="M17 9l4 6M21 9l-4 6" />}
        </svg>
        <AnimatePresence>
          {on && started && (
            <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="flex items-end gap-[2px] overflow-hidden" aria-hidden>
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="w-[2px] rounded-full bg-or" animate={{ height: [3, 9, 4, 7, 3] }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }} />
              ))}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
