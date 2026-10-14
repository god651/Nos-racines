import { notFound } from "next/navigation";
import { CoffreDetail } from "@/components/coffre/CoffreDetail";
import { isDue, isRecipient, openDateOf, recipientsLabel } from "@/lib/local/coffre";
import { requireMember } from "@/lib/server/page";

export default async function CoffrePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { s, viewer } = await requireMember();
  const { id } = await params;
  const sp = await searchParams;
  const c = s.capsules.find((x) => x.id === id);
  if (!c) notFound();
  const me = viewer.user!;
  return (
    <CoffreDetail
      d={{ capsule: c, me, author: c.by === me.id, recipient: isRecipient(c, me), due: isDue(c), openDate: openDateOf(c), toLabel: recipientsLabel(c), justSealed: sp.scelle === "1" }}
    />
  );
}
