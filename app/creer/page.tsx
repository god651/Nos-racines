import { redirect } from "next/navigation";
import { CreateFamily } from "@/components/forms/CreateFamily";
import { read } from "@/lib/server/store";

export default function CreerPage() {
  if (read().family) redirect("/accueil");
  return <CreateFamily />;
}
