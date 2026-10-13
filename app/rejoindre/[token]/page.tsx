import { JoinFamily } from "@/components/forms/JoinFamily";
import { getT } from "@/lib/i18n/server";
import { read } from "@/lib/server/store";

export default async function RejoindrePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
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
      invalidText={t("Ce code ou ce QR code n’est plus valable. Demandez-en un nouveau au fondateur de la famille.")}
    />
  );
}
