import { GriotView } from "@/components/GriotView";
import { childrenOf } from "@/lib/genealogy";
import { requireMember } from "@/lib/server/page";
import { griotOnlineAvailable } from "@/lib/griot-ai";

export const dynamic = "force-dynamic";

// Suggestions construites à partir de l'arbre réel de la famille.
export default async function GriotPage() {
  const { s, t, viewer } = await requireMember();
  const sug: string[] = [t("Combien de générations avons-nous ?")];
  if (s.persons.some((p) => p.isLiving && p.birthYear)) sug.push(t("Qui est le doyen de la famille ?"));
  const villages = new Map<string, number>();
  s.persons.forEach((p) => p.village && villages.set(p.village, (villages.get(p.village) ?? 0) + 1));
  const village = [...villages.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (village) sug.push(t("Quels membres sont originaires de {lieu} ?", { lieu: village }));
  const parent = s.persons.find((p) => childrenOf(s, p.id).length > 0);
  if (parent) sug.push(t("Qui sont les enfants de {nom} ?", { nom: parent.givenName }));
  const withParents = s.persons.find((p) => s.parentages.some((x) => x.childId === p.id));
  if (withParents) sug.push(t("Qui sont les parents de {nom} ?", { nom: withParents.givenName }));
  const gourmet = s.persons.find((p) => (p.favoriteDishes ?? []).length);
  if (gourmet) sug.push(t("Quel est le plat préféré de {nom} ?", { nom: gourmet.givenName }));
  sug.push(t("Combien de personnes dans l’arbre ?"));
  // Questions libres (Griot en ligne) : récits, sens des noms, traditions.
  if (griotOnlineAvailable()) {
    const elder = s.persons.filter((p) => !p.placeholder && p.birthYear).sort((a, b) => a.birthYear! - b.birthYear!)[0];
    const named = s.persons.find((p) => p.dayName);
    const extra = [
      elder && t("Raconte-moi la vie de {nom}", { nom: elder.givenName }),
      named && t("Que signifie le nom {nom} ?", { nom: named.dayName! }),
      t("Comment suis-je lié(e) aux autres branches de la famille ?"),
      t("Quelles questions poser à nos anciens pour garder leur mémoire ?"),
    ].filter(Boolean) as string[];
    sug.unshift(...extra.slice(0, 2));
    sug.push(...extra.slice(2));
  }
  return <GriotView suggestions={sug} meId={viewer.user?.personId} />;
}
