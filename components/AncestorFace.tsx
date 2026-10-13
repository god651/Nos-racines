import { motion } from "framer-motion";

// Le visage d'un ancêtre, fondu dans le décor comme un souvenir dans la lumière :
// noir et blanc adouci, bords effacés, à peine visible, qui respire lentement.

/** Visage choisi par la famille : le père du fondateur (remplaçable dans Paramètres › Générique). */
export const DEFAULT_FACE = "./visage-pere.jpg";

export function AncestorFace({ src, size = 260, opacity = 0.24, className = "", delay = 0 }: { src?: string; size?: number; opacity?: number; className?: string; delay?: number }) {
  if (!src) return null;
  return (
    <div aria-hidden className={`pointer-events-none absolute ${className}`}>
    <motion.div
      style={{
        width: size,
        height: size * 1.15,
        mixBlendMode: "screen",
        WebkitMaskImage: "radial-gradient(ellipse 56% 56% at 50% 44%, #000 40%, transparent 74%)",
        maskImage: "radial-gradient(ellipse 56% 56% at 50% 44%, #000 40%, transparent 74%)",
      }}
      initial={{ opacity: 0, scale: 1.08, filter: "blur(6px)" }}
      animate={{ opacity: [0, opacity, opacity * 0.75, opacity], scale: [1.08, 1, 1.02, 1], filter: "blur(0.3px)" }}
      transition={{
        opacity: { delay, duration: 9, times: [0, 0.35, 0.7, 1], ease: "easeInOut", repeat: Infinity, repeatType: "mirror" },
        scale: { delay, duration: 9, times: [0, 0.35, 0.7, 1], ease: "easeInOut", repeat: Infinity, repeatType: "mirror" },
        filter: { delay, duration: 2.6, ease: "easeOut" },
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" style={{ filter: "grayscale(1) sepia(.35) contrast(1.15) brightness(1.05)" }} draggable={false} onError={(e) => ((e.currentTarget.closest("[aria-hidden]") as HTMLElement).style.display = "none")} />
    </motion.div>
    </div>
  );
}
