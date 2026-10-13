import { TreeView } from "@/components/TreeView";
import { requireMember } from "@/lib/server/page";
import { layoutTree } from "@/lib/tree-layout";
import { anniversaries } from "@/lib/anniversaries";

export const dynamic = "force-dynamic";

export default async function ArbrePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { s, viewer, family } = await requireMember();
  const { p } = await searchParams;
  const voices = new Set(s.stories.map((x) => x.personId));
  const annivs = new Map(anniversaries(s.persons, 7).map((a) => [a.personId, a.kind] as const));
  const layout = layoutTree(s.persons, s.parentages, s.unions, voices, 390, annivs);
  return <TreeView layout={layout} mode={viewer.isAdmin ? "admin" : "membre"} familyName={family.name} startId={p ?? viewer.user?.personId} />;
}
