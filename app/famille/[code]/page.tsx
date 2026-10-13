import { notFound } from "next/navigation";
import { TreeView } from "@/components/TreeView";
import { read } from "@/lib/server/store";
import { layoutTree } from "@/lib/tree-layout";

// Arbre en lecture seule, ouvert par le QR code « arbre » (aucun compte nécessaire).
// On y voit les noms et les visages ; seules les fiches publiques s'ouvrent.

export const dynamic = "force-dynamic";

export default async function ArbreVisiteur({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const s = read();
  if (!s.family || s.family.treeCode !== code.toUpperCase()) notFound();
  const visible = s.persons.map((p) => (p.visibility === "public" ? p : { ...p, photoId: undefined, job: undefined, city: undefined, village: undefined }));
  const layout = layoutTree(visible, s.parentages, s.unions, new Set());
  return <TreeView layout={layout} mode="visiteur" familyName={s.family.name} />;
}
