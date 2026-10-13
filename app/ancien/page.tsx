import { AncienView } from "@/components/AncienView";
import { personOptions } from "@/lib/server/forms";
import { requireMember } from "@/lib/server/page";
import { fullName } from "@/lib/types";

export default async function AncienPage({ searchParams }: { searchParams: Promise<{ personne?: string }> }) {
  const { s, viewer } = await requireMember();
  const { personne } = await searchParams;
  // Par défaut, on propose le plus âgé des vivants : c'est souvent lui ou elle qui raconte.
  const eldest = s.persons.filter((p) => p.isLiving && p.birthYear).sort((a, b) => a.birthYear! - b.birthYear!)[0];
  const teller = s.persons.find((p) => p.id === personne) ?? eldest ?? s.persons[0];
  const stories = [...s.stories]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((st) => {
      const p = s.persons.find((x) => x.id === st.personId);
      return { id: st.id, title: st.title, audioId: st.audioId, durationSec: st.durationSec, personName: p ? fullName(p) : "", photoId: p?.photoId, personId: st.personId };
    });
  return (
    <AncienView
      isAdmin={viewer.isAdmin}
      options={[...personOptions(s)].sort((a, b) => Number(!s.persons.find((p) => p.id === a.id)?.isLiving) - Number(!s.persons.find((p) => p.id === b.id)?.isLiving))}
      tellerId={teller?.id}
      stories={stories}
    />
  );
}
