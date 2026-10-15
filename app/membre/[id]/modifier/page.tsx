import { notFound, redirect } from "next/navigation";
import { PersonForm } from "@/components/forms/PersonForm";
import { personOptions, relationsOf } from "@/lib/server/forms";
import { requireMember } from "@/lib/server/page";

export default async function ModifierPersonne({ params }: { params: Promise<{ id: string }> }) {
  const { s, viewer } = await requireMember();
  const { id } = await params;
  const person = s.persons.find((p) => p.id === id);
  if (!person) notFound();
  // Un membre ne modifie que sa propre fiche, et une seule fois.
  const selfOnce = !viewer.canEdit;
  if (selfOnce && (viewer.user?.personId !== id || person.selfEditedAt)) redirect(`/membre/${id}`);
  return <PersonForm person={person} options={personOptions(s)} initial={relationsOf(s, id)} backHref={`/membre/${id}`} selfOnce={selfOnce} />;
}
