import { CoffreCreate } from "@/components/coffre/CoffreCreate";
import { suggestions } from "@/lib/local/coffre";
import { requireMember } from "@/lib/server/page";
import { fullName } from "@/lib/types";

export default async function NouveauCoffre() {
  const { s, viewer } = await requireMember();
  const me = viewer.user!;
  // Toutes les personnes de l'arbre (sauf soi), et les comptes qui ne sont pas encore dans l'arbre.
  const people = [
    ...s.persons.filter((p) => !p.placeholder && p.id !== me.personId).map((p) => ({ id: p.id, name: fullName(p), kind: "person" as const })),
    ...s.users.filter((u) => u.id !== me.id && !u.personId).map((u) => ({ id: u.id, name: u.name, kind: "user" as const })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  return <CoffreCreate d={{ me, suggestions: suggestions(s, me), people }} />;
}
