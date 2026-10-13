import { JoinFamily } from "@/components/forms/JoinFamily";
import { getT } from "@/lib/i18n/server";
import { read } from "@/lib/server/store";
import { splitJoin } from "@/lib/share-code";

export default async function RejoindrePage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const { token, cloud } = splitJoin(decodeURIComponent(raw));
  const s = read();
  const code = token.trim().toUpperCase().replace(/[^A-Z0-9_-]/gi, "");
  const inv = s.invites.find((i) => (i.token === token || (i.kind === "account" && i.token === code)) && !i.revoked && !(i.kind === "account" && i.uses > 0));
  const { t } = await getT();
  return (
    <JoinFamily
      token={token}
      familyName={s.family?.name ?? ""}
      valid={Boolean(inv && s.family)}
      deviceLinkName={inv?.forUserId ? s.users.find((u) => u.id === inv.forUserId)?.name : undefined}
      hasFamily={!!s.family}
      cloud={cloud}
      needsName={!/^[A-Z0-9]{8}$/.test(code)}
      invalidText={t("Ce code ou ce QR code n’est plus valable. Demandez-en un nouveau au fondateur de la famille.")}
    />
  );
}
