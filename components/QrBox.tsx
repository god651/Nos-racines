// Affiche un QR code SVG déjà calculé sur le serveur.
export function QrBox({ svg, size = 132, className = "" }: { svg: string; size?: number; className?: string }) {
  return <div className={`[&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
