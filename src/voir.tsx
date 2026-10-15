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
import { cloudAvailable, supa } from "@/lib/cloud";

// Page publique ouverte en scannant un QR code avec n'importe quel téléphone.
// Tout ce qui s'affiche est contenu dans le lien : aucune donnée n'est stockée en ligne.

const APK = import.meta.env.VITE_APK_URL || "";
const WEB = import.meta.env.VITE_WEB_APP_URL || "";
const lang = /^en\b/i.test(navigator.language || "") ? "en" : "fr";
document.documentElement.lang = lang;

// Lien reçu par e-mail : confirmation de l'adresse, ou nouveau mot de passe.
const AUTH = new URLSearchParams(location.hash.replace(/^#/, ""));
const AUTH_TYPE = AUTH.get("access_token") ? AUTH.get("type") : null;

function AuthLanding() {
  const t = useT();
  const [pw, setPw] = useState("");
  const [state, setState] = useState<"" | "busy" | "ok" | string>("");
  const done = AUTH_TYPE !== "recovery";
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-nuit px-8 text-center text-coton">
      <Logo size={80} />
      <p className="font-serif text-sm tracking-[5px] text-or">NOS RACINES</p>
      {done || state === "ok" ? (
        <p className="max-w-[320px] text-[15px] leading-relaxed text-coton/85">
          {state === "ok" ? t("Nouveau mot de passe enregistré. Revenez dans l’application et connectez-vous.") : t("Adresse e-mail confirmée. Revenez dans l’application et connectez-vous.")}
        </p>
      ) : (
        <form
          className="flex w-full max-w-[320px] flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setState("busy");
            try {
              const c = supa();
              const { error: e1 } = await c.auth.setSession({ access_token: AUTH.get("access_token")!, refresh_token: AUTH.get("refresh_token") ?? "" });
              if (e1) throw e1;
              const { error: e2 } = await c.auth.updateUser({ password: pw });
              if (e2) throw e2;
              await c.auth.signOut();
              history.replaceState(null, "", location.pathname);
              setState("ok");
            } catch {
              setState(t("Le lien a expiré. Redemandez-en un depuis l’application (Mot de passe oublié)."));
            }
          }}
        >
          <p className="text-[15px] text-coton/85">{t("Choisissez votre nouveau mot de passe.")}</p>
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" minLength={8} required autoComplete="new-password" className="rounded-[14px] border border-or-pale/30 bg-coton/10 px-4 py-3.5 text-[16px] text-coton outline-none focus:border-or" />
          <button disabled={state === "busy" || pw.length < 8} className="min-h-12 rounded-full bg-or text-[15px] font-semibold text-nuit disabled:opacity-50">
            {state === "busy" ? "…" : t("Enregistrer")}
          </button>
          {state && state !== "busy" && <p className="text-[13px] text-[#F3C9B8]">{state}</p>}
        </form>
      )}
    </main>
  );
}

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
      {AUTH_TYPE && cloudAvailable ? <AuthLanding /> : <Page />}
    </div>
  </I18nProvider>,
);
