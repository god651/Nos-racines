import { WhoAmI } from "@/components/account/WhoAmI";
import { requireMember } from "@/lib/server/page";

export default async function QuiPage() {
  await requireMember();
  return <WhoAmI />;
}
