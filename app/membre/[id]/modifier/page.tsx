import { notFound } from "next/navigation";
import { PersonForm } from "@/components/forms/PersonForm";
import { personOptions, relationsOf } from "@/lib/server/forms";
import { requireAdmin } from "@/lib/server/page";

export default async function ModifierPersonne({ params }: { params: Promise<{ id: string }> }) {
  const { s } = await requireAdmin();
  const { id } = await params;
  const person = s.persons.find((p) => p.id === id);
  if (!person) notFound();
  return <PersonForm person={person} options={personOptions(s)} initial={relationsOf(s, id)} backHref={`/membre/${id}`} />;
}
