import { CapsuleView } from "@/components/CapsuleView";
import { requireMember } from "@/lib/server/page";

export default async function CapsulePage() {
  const { s, viewer } = await requireMember();
  const year = new Date().getFullYear();
  // Le contenu d'une capsule n'est jamais envoyé au téléphone avant sa date d'ouverture.
  const mine = s.capsules.filter((c) => c.by === viewer.user!.id && c.openYear > year).map((c) => ({ ...c, text: undefined, mediaId: undefined }));
  const opened = s.capsules.filter((c) => c.openYear <= year);
  return <CapsuleView mine={mine} opened={opened} />;
}
