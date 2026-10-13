import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { NotFoundSignal, RedirectSignal } from "next/navigation";
import { ConfirmHost } from "@/components/Confirm";
import { CropHost } from "@/components/Cropper";
import { Guide, guideSeen } from "@/components/Guide";
import { Intro } from "@/components/Intro";
import { viewerFromToken } from "@/lib/server/auth";
import { SoundLayer } from "@/components/SoundLayer";
import { dictFor } from "@/lib/i18n/server";
import { I18nProvider, useT } from "@/lib/i18n/client";
import { isLang } from "@/lib/i18n/core";
import { getDataVersion, kv, legacy, persistent, read, subscribeData } from "@/lib/local/store-core";
import { LegacyPrompt } from "@/components/LegacyPrompt";
import { UpdateHost } from "@/components/UpdateHost";
import { initNative, isNative } from "@/lib/native";
import { back as routerBack } from "@/lib/local/router";
import { getRoute, getRouteVersion, match, navigate, subscribeRoute } from "@/lib/local/router";
import Onboarding from "@/app/page";
import Accueil from "@/app/accueil/page";
import Ancien from "@/app/ancien/page";
import Arbre from "@/app/arbre/page";
import Bienvenue from "@/app/bienvenue/page";
import Capsule from "@/app/capsule/page";
import Creer from "@/app/creer/page";
import FamilleCode from "@/app/famille/[code]/page";
import Griot from "@/app/griot/page";
import Membre from "@/app/membre/[id]/page";
import Modifier from "@/app/membre/[id]/modifier/page";
import Moi from "@/app/moi/page";
import Quiz from "@/app/quiz/page";
import Memorial from "@/app/memorial/[id]/page";
import Parametres from "@/app/parametres/page";
import NouvellePersonne from "@/app/personne/nouvelle/page";
import QrPublic from "@/app/q/[code]/page";
import QrCodes from "@/app/qr/page";
import Rejoindre from "@/app/rejoindre/[token]/page";
import NouveauSouvenir from "@/app/souvenir/nouveau/page";
import Voir from "@/app/voir/page";
import Carte from "@/app/carte/page";
import Fondateur from "@/app/fondateur/page";
import { ScanHost } from "@/components/Scanner";
import { logOpen } from "@/lib/activity";
import { startSync } from "@/lib/local/sync";

// Les écrans de l'application. Ceux qui lisent les données sont des fonctions
// qui préparent les informations puis renvoient l'écran à afficher.
type PageFn = (props: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string>> }) => ReactNode | Promise<ReactNode>;
const ROUTES: [string, PageFn][] = [
  ["/accueil", Accueil as unknown as PageFn],
  ["/ancien", Ancien as unknown as PageFn],
  ["/arbre", Arbre as unknown as PageFn],
  ["/bienvenue", Bienvenue as unknown as PageFn],
  ["/capsule", Capsule as unknown as PageFn],
  ["/creer", Creer as unknown as PageFn],
  ["/famille/:code", FamilleCode as unknown as PageFn],
  ["/griot", Griot as unknown as PageFn],
  ["/membre/:id", Membre as unknown as PageFn],
  ["/membre/:id/modifier", Modifier as unknown as PageFn],
  ["/moi", Moi as unknown as PageFn],
  ["/quiz", Quiz as unknown as PageFn],
  ["/memorial/:id", Memorial as unknown as PageFn],
  ["/parametres", Parametres as unknown as PageFn],
  ["/personne/nouvelle", NouvellePersonne as unknown as PageFn],
  ["/q/:code", QrPublic as unknown as PageFn],
  ["/qr", QrCodes as unknown as PageFn],
  ["/rejoindre/:token", Rejoindre as unknown as PageFn],
  ["/souvenir/nouveau", NouveauSouvenir as unknown as PageFn],
  ["/voir", Voir as unknown as PageFn],
  ["/carte", Carte as unknown as PageFn],
  ["/fondateur", Fondateur as unknown as PageFn],
];

export function App() {
  // Générique d'ouverture : une fois à chaque lancement de l'application.
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    logOpen();
    startSync();
    const replay = () => {
      logOpen();
      setIntro(true);
    };
    window.addEventListener("nr-intro", replay);
    window.addEventListener("nr-resume", replay);
    // Application Android : barre d'état, bouton retour, écran de démarrage.
    void initNative(() => {
      const p = getRoute().path;
      if (p === "/accueil" || p === "/") return false;
      routerBack();
      return true;
    });
    // Quand on ferme l'application puis qu'on la rouvre (la page revient à l'écran),
    // le générique se rejoue.
    let hiddenAt = 0;
    const vis = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 2000) replay();
    };
    const show = (e: PageTransitionEvent) => e.persisted && setIntro(true);
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pageshow", show);
    return () => {
      window.removeEventListener("nr-intro", replay);
      window.removeEventListener("nr-resume", replay);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("pageshow", show);
    };
  }, []);
  const dataV = useSyncExternalStore(subscribeData, getDataVersion);
  useSyncExternalStore(subscribeRoute, getRouteVersion);
  const route = getRoute();
  const c = kv.get("nr_langue");
  const lang = isLang(c) ? c : read().settings.language ?? "fr";
  // Nouvelle copie à chaque changement : une langue traduite s'affiche aussitôt.
  const dict = useMemo(() => ({ ...dictFor(lang) }), [lang, dataV]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Visite guidée : à la première arrivée d'un compte sur l'accueil.
  const [guideTick, setGuideTick] = useState(0);
  const viewer = viewerFromToken(read(), kv.get("nr_session"));
  const showGuide = route.path === "/accueil" && !!viewer.user && !guideSeen(viewer.user.id) && !intro && !legacy;
  void guideTick;

  // Au premier lancement, une famille existe déjà : on va directement à l'accueil.
  useEffect(() => {
    if (route.path === "/" && read().family && kv.get("nr_session")) navigate("/accueil", true);
  }, [route.path]);

  return (
    <I18nProvider lang={lang} dict={dict}>
      <div className="mx-auto min-h-dvh w-full max-w-[440px] overflow-x-clip bg-coton shadow-[0_0_80px_rgba(0,0,0,0.5)]">
        {route.path === "/" ? <Onboarding /> : <PageHost path={route.path} query={route.query} dataV={dataV} />}
      </div>
      {!persistent && !isNative && <DemoNotice />}
      <UpdateHost blocked={intro || showGuide || !!legacy} />
      <ConfirmHost />
      <CropHost />
      <ScanHost />
      {showGuide && viewer.user && <Guide userId={viewer.user.id} isAdmin={viewer.isAdmin} onDone={() => setGuideTick((x) => x + 1)} />}
      {intro && <Intro onDone={() => setIntro(false)} />}
      {!intro && legacy && <LegacyPrompt legacy={legacy} />}
      <SoundLayer />
    </I18nProvider>
  );
}

function PageHost({ path, query, dataV }: { path: string; query: URLSearchParams; dataV: number }) {
  const key = path + "?" + query.toString();
  const [view, setView] = useState<{ key: string; el: ReactNode } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const found = ROUTES.map(([p, fn]) => ({ fn, params: match(p, path) })).find((x) => x.params);
    if (!found) {
      setView({ key, el: <NotFound /> });
      return;
    }
    const props = { params: Promise.resolve(found.params!), searchParams: Promise.resolve(Object.fromEntries(query)) };
    (async () => {
      try {
        const el = await found.fn(props);
        if (!cancelled) setView({ key, el });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof RedirectSignal) navigate(e.to, true);
        else if (e instanceof NotFoundSignal) setView({ key, el: <NotFound /> });
        else {
          console.error(e);
          setView({ key, el: <NotFound /> });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, dataV]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!view) return <div className="min-h-dvh bg-nuit" />;
  return <div key={view.key}>{view.el}</div>;
}

function NotFound() {
  const t = useT();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-nuit px-8 text-center text-coton">
      <p className="font-serif text-2xl">{t("Introuvable")}</p>
      <a href="/accueil" className="mt-6 rounded-full bg-or px-6 py-3 font-semibold text-nuit">{t("Retour à l’accueil")}</a>
    </main>
  );
}

function DemoNotice() {
  const t = useT();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[90px] z-40 mx-auto flex max-w-[440px] justify-center px-4">
      <p className="rounded-full bg-terre/90 px-3 py-1.5 text-center text-[11px] text-coton shadow">{t("Mode démo : les données ne seront pas gardées après fermeture.")}</p>
    </div>
  );
}
