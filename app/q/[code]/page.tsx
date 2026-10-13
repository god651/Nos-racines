import { notFound } from "next/navigation";
import { PublicProfile } from "@/components/PublicProfile";
import { getViewer } from "@/lib/server/auth";
import { read } from "@/lib/server/store";
import { fullName } from "@/lib/types";

// Page ouverte en scannant le QR code imprimé sous un portrait. Aucun compte nécessaire.
// Fiche « publique » : portrait, dates, citation, grandes étapes. Fiche « famille » : le nom seulement.

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const p = read().persons.find((x) => x.qrCode === code.toUpperCase());
  return { title: p ? `${fullName(p)} — NOS RACINES` : "NOS RACINES" };
}

export default async function QrPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const s = read();
  const p = s.persons.find((x) => x.qrCode === code.toUpperCase());
  if (!p || !s.family) notFound();
  const isMember = !!(await getViewer()).user;
  const pub = p.visibility === "public" || isMember;
  const years = p.birthYear ? (p.deathYear ? `${p.birthYear} – ${p.deathYear}` : `${p.birthYear}`) : p.deathYear ? `† ${p.deathYear}` : "";
  return (
    <PublicProfile
      d={{
        familyName: s.family.name.replace(/^famille\s+/i, ""),
        name: fullName(p),
        years: pub ? years : "",
        village: pub ? p.village : undefined,
        quote: pub ? p.quote : undefined,
        bio: pub ? p.bio : undefined,
        photoId: pub ? p.photoId : undefined,
        isPublic: pub,
        events: pub ? [...p.timeline].sort((a, b) => a.year - b.year) : [],
        isMember,
        personId: p.id,
      }}
    />
  );
}
