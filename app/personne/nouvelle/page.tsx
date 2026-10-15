import { PersonForm } from "@/components/forms/PersonForm";
import { personOptions } from "@/lib/server/forms";
import { kinChoices, RELATIONS, type Relation } from "@/lib/server/kinship";
import { requireEditor } from "@/lib/server/page";

// Ajout d'une personne. Raccourcis depuis une fiche : ?parent=… (ajouter un enfant), ?conjoint=…, ?enfant=… (ajouter un parent).

export default async function NouvellePersonne({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { s, family } = await requireEditor();
  const q = await searchParams;
  const exists = (id?: string) => (id && s.persons.some((p) => p.id === id) ? id : undefined);
  const parent = exists(q.parent);
  const spouse = exists(q.conjoint);
  const child = exists(q.enfant);
  // Ajouter l'enfant d'un couple : on propose le conjoint comme second parent.
  const otherParent = parent ? s.unions.find((u) => u.partnerA === parent || u.partnerB === parent) : undefined;
  const parents = parent ? [parent, otherParent ? (otherParent.partnerA === parent ? otherParent.partnerB : otherParent.partnerA) : ""].filter(Boolean) : [];
  const de = exists(q.de) ?? parent ?? spouse ?? child;
  const lien = RELATIONS.includes(q.lien as Relation) ? (q.lien as Relation) : undefined;
  const choices = Object.fromEntries(s.persons.map((p) => [p.id, kinChoices(s, p.id)]));
  return (
    <PersonForm
      anchor={{ id: de ?? "", relation: lien, choices }}
      options={personOptions(s)}
      backHref={de ? `/membre/${de}` : q.moi ? "/moi" : "/arbre"}
      defaultFamilyName={spouse ? undefined : family.name.replace(/^famille\s+/i, "")}
      isMe={q.moi === "1"}
      initial={{
        parents,
        parentKind: "biological",
        spouses: spouse ? [{ id: spouse, kind: "customary" }] : [],
        children: child ? [child] : [],
      }}
    />
  );
}
