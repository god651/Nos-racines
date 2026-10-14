import "@fontsource-variable/fraunces";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/caveat/500.css";
import "@/app/globals.css";
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { I18nProvider, useT } from "@/lib/i18n/client";
import { EN } from "@/lib/i18n/en";
import { decodeShared, type Decoded } from "@/lib/share-code";
import { SharedFooter, SharedPerson, SharedTree } from "@/components/SharedView";
import { Logo } from "@/components/Logo";

// Page publique ouverte en scannant un QR code avec n'importe quel téléphone.
// Tout ce qui s'affiche est contenu dans le lien : aucune donnée n'est stockée en ligne.

const APK = import.meta.env.VITE_APK_URL || "";
const WEB = import.meta.env.VITE_WEB_APP_URL || "";
const lang = /^en\b/i.test(navigator.language || "") ? "en" : "fr";
document.documentElement.lang = lang;

function Page() {
  const t = useT();
  const [d, setD] = useState<Decoded>(() => decodeShared(location.href));
  useEffect(() => {
    const on = () => setD(decodeShared(location.href));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => {
    if (d.kind === "person") document.title = `${d.card.n} — NOS RACINES`;
    if (d.kind === "tree") document.title = `${d.card.f} — NOS RACINES`;
  }, [d]);
  if (d.kind === "person") return <SharedPerson card={d.card} footer={<SharedFooter apkUrl={APK} webUrl={WEB} />} />;
  if (d.kind === "tree") return <SharedTree card={d.card} />;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-nuit px-8 text-center text-coton">
      <Logo size={88} />
      <p className="font-serif text-sm tracking-[5px] text-or">NOS RACINES</p>
      <p className="max-w-[320px] text-[15px] leading-relaxed text-coton/80">
        {d.kind === "join"
          ? t("Ce QR code permet de rejoindre une famille. Il s’ouvre uniquement avec le scanner de l’application Nos Racines.")
          : t("Scannez le QR code d’un portrait ou d’un arbre de famille pour le voir ici.")}
      </p>
      <SharedFooter apkUrl={APK} webUrl={WEB} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <I18nProvider lang={lang} dict={lang === "en" ? EN : {}}>
    <div className="mx-auto min-h-dvh w-full max-w-[440px] overflow-x-clip bg-nuit">
      <Page />
    </div>
  </I18nProvider>,
);
