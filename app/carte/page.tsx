import { CarteView, type MapMember } from "@/components/CarteView";
import { findPlace } from "@/lib/geo";
import { requireMember } from "@/lib/server/page";
import { fullName } from "@/lib/types";

// Carte de la Côte d'Ivoire : d'où vient la famille, où vit chacun aujourd'hui.
export default async function CartePage() {
  const { s, family, viewer } = await requireMember();
  const custom = family.places ?? {};
  const members: MapMember[] = s.persons
    .filter((p) => !p.placeholder)
    .map((p) => ({
      id: p.id,
      name: fullName(p),
      givenName: p.givenName,
      photoId: p.photoId,
      isLiving: p.isLiving,
      years: p.birthYear ? (p.deathYear ? `${p.birthYear} – ${p.deathYear}` : `${p.birthYear}`) : undefined,
      originRaw: p.village || undefined,
      origin: findPlace(p.village, custom),
      homeRaw: p.city || undefined,
      home: findPlace(p.city, custom),
    }));
  return (
    <CarteView
      familyName={family.name}
      familyVillage={family.village || undefined}
      familyOrigin={findPlace(family.village, custom)}
      members={members}
      isAdmin={viewer.canEdit}
    />
  );
}
