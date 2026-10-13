import { MemoryForm } from "@/components/forms/MemoryForm";
import { personOptions } from "@/lib/server/forms";
import { requireAdmin } from "@/lib/server/page";

export default async function NouveauSouvenir({ searchParams }: { searchParams: Promise<{ personne?: string }> }) {
  const { s } = await requireAdmin();
  const { personne } = await searchParams;
  const pre = personne && s.persons.some((p) => p.id === personne) ? [personne] : [];
  return <MemoryForm options={personOptions(s)} preselected={pre} backHref={pre[0] ? `/membre/${pre[0]}` : "/accueil"} covers={s.family!.covers} />;
}
