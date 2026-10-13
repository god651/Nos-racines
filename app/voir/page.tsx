import { notFound } from "next/navigation";
import { SharedPerson, SharedTree } from "@/components/SharedView";
import { BackFloat } from "@/components/BackFloat";
import { decodeShared } from "@/lib/share-code";

// Fiche ou arbre scanné avec l'application (QR code d'une autre famille, ou d'une personne pas encore ici).
export default async function VoirPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { d } = await searchParams;
  const dec = decodeShared("#" + (d ?? ""));
  if (dec.kind === "person") return <SharedPerson card={dec.card} footer={<BackFloat inline />} />;
  if (dec.kind === "tree")
    return (
      <>
        <SharedTree card={dec.card} />
        <BackFloat />
      </>
    );
  notFound();
}
