import { CapsuleView, type CoffreRow } from "@/components/CapsuleView";
import { isDue, isRecipient, openDateOf, recipientsLabel } from "@/lib/local/coffre";
import { requireMember } from "@/lib/server/page";
import type { Capsule } from "@/lib/types";

// Les coffres du futur : ceux que j'ai laissés, ceux qui sont ouverts pour moi, ceux qui m'attendent.
export default async function CapsulePage() {
  const { s, viewer } = await requireMember();
  const me = viewer.user!;
  const row = (c: Capsule): CoffreRow => ({ id: c.id, title: c.title, byName: c.byName, toLabel: recipientsLabel(c), openDate: openDateOf(c), due: isDue(c), items: c.itemCount });
  const sorted = [...s.capsules].sort((a, b) => openDateOf(a).localeCompare(openDateOf(b)));
  return (
    <CapsuleView
      mine={sorted.filter((c) => c.by === me.id).map(row)}
      forMe={sorted.filter((c) => isRecipient(c, me) && isDue(c)).map(row)}
      upcoming={sorted.filter((c) => isRecipient(c, me) && !isDue(c)).map(row)}
    />
  );
}
