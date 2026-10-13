// Onde de voix animée. `levels` permet d'afficher le vrai niveau du micro (0 à 1) ;
// sans `levels`, les barres ondulent doucement.

const DEFAULT = [0.4, 0.75, 1, 0.55, 0.9, 0.35, 0.8, 0.6, 0.3];

export function Waveform({
  color = "#C8A15A",
  height = 28,
  barWidth = 3,
  gap = 3,
  levels,
  animated = true,
}: {
  color?: string;
  height?: number;
  barWidth?: number;
  gap?: number;
  levels?: number[];
  animated?: boolean;
}) {
  const bars = levels ?? DEFAULT;
  return (
    <span aria-hidden className="inline-flex items-center" style={{ gap, height }}>
      {bars.map((v, i) => (
        <span
          key={i}
          className={!levels && animated ? "nr-bar" : undefined}
          style={{
            width: barWidth,
            height: Math.max(3, v * height),
            borderRadius: barWidth,
            background: color,
            animationDelay: `${i * 0.12}s`,
            transition: levels ? "height 80ms linear" : undefined,
          }}
        />
      ))}
    </span>
  );
}
