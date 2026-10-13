import { motion } from "framer-motion";

// « Portrait vivant » d'un défunt : la photo respire très lentement, tourne à peine
// comme un visage qui se tourne vers vous, et une lumière chaude passe dessus.
// Effet de mise en scène (pas d'IA générative) : la photo n'est jamais modifiée.

export function LivingPortrait({
  src,
  className = "",
  imgClassName = "",
  filter = "sepia(.55) contrast(1.02) brightness(.92)",
  intensity = 1,
}: {
  src: string;
  className?: string;
  imgClassName?: string;
  filter?: string;
  intensity?: number;
}) {
  const k = intensity;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ perspective: 600 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.img
        src={src}
        alt=""
        draggable={false}
        className={`h-full w-full object-cover ${imgClassName}`}
        style={{ filter, transformOrigin: "50% 40%" }}
        animate={{
          scale: [1.04, 1.04 + 0.05 * k, 1.06, 1.04],
          rotateY: [-2 * k, 2.5 * k, 0, -2 * k],
          rotateX: [1 * k, -1 * k, 0.5 * k, 1 * k],
          x: [`${-1 * k}%`, `${1.2 * k}%`, `${0.3 * k}%`, `${-1 * k}%`],
          y: [`${0.6 * k}%`, `${-0.8 * k}%`, `${0.4 * k}%`, `${0.6 * k}%`],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Lumière qui passe doucement, comme un rayon de soleil sur une vieille photo. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(115deg, transparent 30%, rgba(255,226,170,0.28) 48%, transparent 66%)", mixBlendMode: "soft-light" }}
        animate={{ x: ["-120%", "120%"] }}
        transition={{ duration: 7, repeat: Infinity, repeatDelay: 5, ease: "easeInOut" }}
      />
      {/* Halo qui respire. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,214,150,0.22),transparent_60%)]"
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
