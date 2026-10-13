// Portrait sépia en silhouette, utilisé tant qu'aucune photo n'est ajoutée.
// Dès qu'une vraie photo existe, on passe `src` et on garde le même cadre.

export function Portrait({
  size = 64,
  src,
  alt = "",
  ring = "#C8A15A",
  headwrap = false,
  className = "",
}: {
  size?: number;
  src?: string;
  alt?: string;
  ring?: string;
  headwrap?: boolean;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={`rounded-full object-cover [filter:sepia(.6)_contrast(.95)] ${className}`}
        style={{ border: `3px solid ${ring}` }}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden
      className={`shrink-0 rounded-full [filter:sepia(1)_contrast(.9)] ${className}`}
      style={{ border: `3px solid ${ring}`, boxSizing: "border-box" }}
    >
      <rect width="64" height="64" fill="#B89566" />
      {headwrap && <path d="M19 20c3-10 23-10 26 0 1 4-2 6-5 6H24c-3 0-6-2-5-6z" fill="#7A5A30" />}
      <circle cx="32" cy="27" r="11" fill="#5E4526" />
      <path d="M8 64c3-16 12-24 24-24s21 8 24 24z" fill="#5E4526" />
    </svg>
  );
}

export function Polaroid({
  caption,
  tilt = 0,
  width = 118,
  children,
}: {
  caption: string;
  tilt?: number;
  width?: number;
  children?: React.ReactNode;
}) {
  return (
    <figure
      className="m-0 shrink-0 bg-white p-[7px] pb-[10px] shadow-[0_6px_16px_rgba(18,38,26,0.14)] transition-transform duration-500 hover:-translate-y-1 hover:rotate-0"
      style={{ width, transform: `rotate(${tilt}deg)` }}
    >
      {children ?? (
        <svg viewBox="0 0 104 90" className="block w-full [filter:sepia(.9)_contrast(.9)]" aria-hidden>
          <rect width="104" height="90" fill="#B89566" />
          <circle cx="52" cy="36" r="13" fill="#5E4526" />
          <path d="M20 90c4-22 16-32 32-32s28 10 32 32z" fill="#5E4526" />
        </svg>
      )}
      <figcaption className="mt-1 font-main text-[16px] leading-tight text-[#3A3020]">{caption}</figcaption>
    </figure>
  );
}
