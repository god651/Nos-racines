import { MeView } from "@/components/MeView";
import { personOptions } from "@/lib/server/forms";
import { requireMember } from "@/lib/server/page";
import { fullName } from "@/lib/types";

export const dynamic = "force-dynamic";

// Espace personnel : qui je suis dans l'arbre, ce que j'ai apporté, mes appareils.
export default async function MoiPage() {
  const { s, family, viewer, lang } = await requireMember();
  const u = viewer.user!;
  const me = u.personId ? s.persons.find((p) => p.id === u.personId) : undefined;
  const year = new Date().getFullYear();
  const myCapsules = s.capsules.filter((c) => c.by === u.id);
  return (
    <MeView
      d={{
        id: u.id,
        name: u.name,
        isAdmin: viewer.isAdmin,
        since: u.createdAt,
        familyName: family.name,
        lang,
        person: me ? { id: me.id, name: fullName(me), photoId: me.photoId } : null,
        options: personOptions(s).map((o) => ({ id: o.id, name: o.name })),
        contributions: {
          stories: s.stories.filter((x) => x.by === u.id).length,
          memories: s.memories.filter((x) => x.by === u.id).length,
          capsulesSealed: myCapsules.filter((c) => c.openYear > year).length,
          capsulesOpen: myCapsules.filter((c) => c.openYear <= year).length,
        },
        isLastAdmin: viewer.isOwner || (viewer.isAdmin && s.users.filter((x) => x.role === "admin").length <= 1),
        isOwner: viewer.isOwner,
      }}
    />
  );
}
