import { QrCenter } from "@/components/QrCenter";
import { baseUrl } from "@/lib/server/auth";
import { requireMember } from "@/lib/server/page";
import { qrSvg } from "@/lib/server/qr";
import { fullName } from "@/lib/types";

export const dynamic = "force-dynamic";

// Les trois sortes de QR codes : l'arbre (lecture seule, sans compte), les invitations
// (rejoindre la famille en lecture seule) et un QR code par personne (à imprimer sous son portrait).

export default async function QrPage() {
  const { s, family, viewer } = await requireMember();
  const base = await baseUrl();
  const treeLink = `${base}/famille/${family.treeCode}`;
  const invites = viewer.isAdmin
    ? await Promise.all(
        s.invites
          .filter((i) => !i.revoked && !i.forUserId)
          .sort((a, b) => b.createdAt - a.createdAt)
          .map(async (i) => {
            const link = `${base}/rejoindre/${i.token}`;
            return { token: i.token, link, svg: await qrSvg(link), uses: i.uses, createdAt: i.createdAt };
          }),
      )
    : [];
  const persons = await Promise.all(
    [...s.persons]
      .sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999))
      .map(async (p) => {
        const link = `${base}/q/${p.qrCode}`;
        return { id: p.id, name: fullName(p), code: p.qrCode, isPublic: p.visibility === "public", link, svg: await qrSvg(link, "#12261A", "#FFFFFF") };
      }),
  );
  return (
    <QrCenter
      familyName={family.name}
      isAdmin={viewer.isAdmin}
      tree={{ link: treeLink, svg: await qrSvg(treeLink), code: family.treeCode }}
      invites={invites}
      persons={persons}
      local
    />
  );
}
