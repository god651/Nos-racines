import { GriotView } from "@/components/GriotView";
import { childrenOf } from "@/lib/genealogy";
import { requireMember } from "@/lib/server/page";

export const dynamic = "force-dynamic";

// Suggestions construites à partir de l'arbre réel de la famille.
export default async function GriotPage() {
  const { s, t } = await requireMember();
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
  return <GriotView suggestions={sug} />;
}
