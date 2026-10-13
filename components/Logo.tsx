import { motion } from "framer-motion";

// Logo NOS RACINES : un arbre dont les racines se referment en cercle,
// et dont chaque branche porte une perle (une génération, un visage).
// `draw` : le trait se dessine (générique d'ouverture).

const TRUNK = "M60 92 C59 80 59 70 60 58";
const BRANCHES = [
  "M60 70 C52 64 44 60 36 50",
  "M60 64 C56 54 52 46 50 34",
  "M60 58 C60 48 60 38 60 26",
  "M60 64 C64 54 68 46 70 34",
  "M60 70 C68 64 76 60 84 50",
];
const PEARLS: [number, number][] = [[36, 50], [50, 34], [60, 26], [70, 34], [84, 50]];
const ROOTS = [
  "M60 92 C52 96 40 98 30 94",
  "M60 92 C68 96 80 98 90 94",
  "M60 92 C56 100 50 104 44 106",
  "M60 92 C64 100 70 104 76 106",
];

export function Logo({ size = 96, draw = false, color = "#C8A15A", glow = true }: { size?: number; draw?: boolean; color?: string; glow?: boolean }) {
  const line = (d: string, delay: number, w = 2) => (
    <motion.path
      key={d}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={w}
      strokeLinecap="round"
      initial={draw ? { pathLength: 0, opacity: 0 } : false}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ delay, duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
    />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="NOS RACINES">
      {glow && <circle cx="60" cy="60" r="56" fill="url(#nr-logo-glow)" />}
      <defs>
        <radialGradient id="nr-logo-glow">
          <stop offset="0%" stopColor="rgba(200,161,90,0.22)" />
          <stop offset="100%" stopColor="rgba(200,161,90,0)" />
        </radialGradient>
      </defs>
      <motion.circle
        cx="60"
        cy="60"
        r="54"
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeDasharray="2 5"
        initial={draw ? { pathLength: 0, opacity: 0 } : false}
        animate={{ pathLength: 1, opacity: 0.7 }}
        transition={{ duration: 2.2, ease: "easeInOut" }}
      />
      {ROOTS.map((d, k) => line(d, 0.2 + k * 0.12, 1.6))}
      {line(TRUNK, 0.6, 3)}
      {BRANCHES.map((d, k) => line(d, 1 + k * 0.1, 1.8))}
      {PEARLS.map(([x, y], k) => (
        <motion.circle
          key={k}
          cx={x}
          cy={y}
          r={k === 2 ? 4.5 : 3.6}
          fill={k === 2 ? "#FFF3D1" : "#E6D3A3"}
          initial={draw ? { scale: 0, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.9 + k * 0.12, type: "spring", stiffness: 260, damping: 12 }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      ))}
    </svg>
  );
}
