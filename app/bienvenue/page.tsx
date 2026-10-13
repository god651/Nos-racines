import { redirect } from "next/navigation";
import { Dust, Grain, Vignette } from "@/components/ambiance";
import { CodeEntry } from "@/components/forms/CodeEntry";
import { getT } from "@/lib/i18n/server";
import { getViewer } from "@/lib/server/auth";
import { read } from "@/lib/server/store";

// Un appareil arrive sans invitation : on explique comment rejoindre la famille.

export default async function BienvenuePage() {
  const s = read();
  if (!s.family) redirect("/creer");
  if ((await getViewer()).user) redirect("/accueil");
  const { t } = await getT();
  return (
    <main className="relative flex min-h-dvh flex-col justify-center overflow-hidden bg-nuit px-7 text-coton">
      <Vignette />
      <Dust />
      <Grain />
      <div className="relative">
        <p className="font-serif text-sm tracking-[5px] text-or">NOS RACINES</p>
        <h1 className="mt-4 font-serif text-[34px] font-light leading-tight">{s.family.name}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-or-pale">
          {t("Pour entrer, scannez le QR code d’invitation qu’un administrateur de la famille vous montre (Menu « Moi » → « Inviter un proche »).")}
        </p>
        <div className="mt-6 rounded-[20px] border border-or/40 bg-coton/5 p-4">
          <p className="mb-3 text-sm font-semibold text-or">{t("Vous avez reçu un code d’accès ?")}</p>
          <CodeEntry dark />
        </div>
        <div className="mt-4 rounded-[20px] border border-or-pale/25 bg-coton/5 p-4 text-sm leading-relaxed text-coton/85">
          <p className="font-semibold text-or">{t("Vous êtes déjà administrateur sur un autre appareil ?")}</p>
          <p className="mt-1">{t("Sur cet appareil-là, ouvrez « Moi » → « Ouvrir mon compte sur un autre téléphone », puis scannez le QR code affiché.")}</p>
        </div>
      </div>
    </main>
  );
}
