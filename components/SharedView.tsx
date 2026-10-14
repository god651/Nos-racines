"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { fetchPublicPhoto } from "@/lib/local/sync";
import { getDataVersion, mediaObjectUrl, showMedia, subscribeData } from "@/lib/local/store-core";
import { useT } from "@/lib/i18n/client";
import { treeFromCard, type PersonCard, type TreeCard } from "@/lib/share-code";
import { layoutTree } from "@/lib/tree-layout";
import { Dust, Grain, Vignette } from "./ambiance";
import { Logo } from "./Logo";
import { TreeView } from "./TreeView";

// Ce que montre un QR code « fiche » ou « arbre » : les informations sont dans le code lui-même.
// Utilisé par la page publique (n'importe quel téléphone) et par le scanner de l'application.

const DOVE = "M1 10.5c2.2-.9 4.3-.8 6.2.2.6-2.6 2.5-4.6 5.1-5.3-.9 1.1-1.3 2.2-1.3 3.3 1.5-.3 3.1.1 4.5 1.2.5-.6 1.3-.9 2.2-.8-.5.5-.8 1.1-.9 1.8-.3 2.4-2.3 4.3-5 4.6-2.6.3-5-.7-6.6-2.6-1.3.1-2.8-.3-4.2-1.4z";
const ease = [0.2, 0.7, 0.2, 1] as const;
const up = (delay: number) => ({ initial: { opacity: 0, y: 14, filter: "blur(4px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, transition: { delay, duration: 1, ease } });

const initialsOf = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

export function SharedPerson({ card: c, footer }: { card: PersonCard; footer?: React.ReactNode }) {
  const t = useT();
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (!c.ph) return;
    const [fid, mid] = c.ph.split("/");
    let url = "";
    void fetchPublicPhoto(fid, mid).then((b) => b && setPhoto((url = URL.createObjectURL(b))));
    return () => void (url && URL.revokeObjectURL(url));
  }, [c.ph]);
  const years = c.b ? (c.d ? `${c.b} – ${c.d}` : c.l ? t("né(e) en {a}", { a: c.b }) : `${c.b}`) : c.d ? `† ${c.d}` : "";
  const fam = c.f.replace(/^famille\s+/i, "");
  const rel = [
    { label: t("Parents"), list: c.pa },
    { label: c.co && c.co.length > 1 ? t("Conjoints") : t("Conjoint(e)"), list: c.co },
    { label: t("Enfants"), list: c.en },
  ].filter((r) => r.list?.length);
  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-nuit px-6 pb-8 pt-12 text-center text-coton">
      <Vignette glow="rgba(200,161,90,0.2)" at="50% 20%" />
      <Dust />
      <Grain />
      <motion.p {...up(0.2)} className="relative font-serif text-xs tracking-[5px] text-or">
        {t("FAMILLE {nom}", { nom: fam.toUpperCase() })}
      </motion.p>
      <motion.div {...up(0.4)} className="relative mt-7 flex h-[150px] w-[150px] items-center justify-center rounded-full border border-or/40 bg-[radial-gradient(circle_at_50%_35%,#2A4A33,#12261A)] shadow-[0_0_80px_rgba(200,161,90,0.25)]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <motion.img src={photo} alt="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }} className="absolute inset-0 h-full w-full rounded-full object-cover" style={!c.l ? { filter: "sepia(.35) contrast(1.02)" } : undefined} />
        ) : (
          <span className="font-serif text-[52px] font-light text-or-pale">{initialsOf(c.n)}</span>
        )}
        {!c.l && (
          <svg viewBox="0 0 20 20" className="absolute -right-1 bottom-3 h-8 w-8">
            <path d={DOVE} fill="#E6D3A3" />
          </svg>
        )}
      </motion.div>
      <motion.h1 {...up(0.7)} className="relative mt-6 font-serif text-[34px] font-light leading-tight">
        {c.n}
      </motion.h1>
      {years && (
        <motion.p {...up(0.85)} className="relative mt-1 text-[15px] tracking-[1px] text-or-pale">
          {years}
        </motion.p>
      )}
      {c.dn && (
        <motion.p {...up(0.9)} className="relative mt-1 font-main text-[22px] text-or">
          {c.dn}
        </motion.p>
      )}
      {c.pub ? (
        <motion.div {...up(1.05)} className="relative mt-6 w-full max-w-[380px] space-y-4 text-left">
          {(c.vi || c.ci || c.jo) && (
            <div className="flex flex-wrap justify-center gap-2">
              {c.vi && <Chip>{t("Village : {v}", { v: c.vi })}</Chip>}
              {c.ci && <Chip>{t("Vit à {v}", { v: c.ci })}</Chip>}
              {c.jo && <Chip>{c.jo}</Chip>}
            </div>
          )}
          {c.q && <p className="text-center font-serif text-[19px] italic leading-snug text-or-pale">« {c.q} »</p>}
          {c.bio && <p className="rounded-[20px] bg-white/5 p-4 text-[15px] leading-relaxed text-coton/90">{c.bio}</p>}
          {c.pl && (
            <p className="text-center text-[13px] text-or-pale">
              {t("Plats préférés")} : {c.pl.join(", ")}
            </p>
          )}
          {rel.length > 0 && (
            <div className="rounded-[20px] border border-or/20 p-4">
              {rel.map((r) => (
                <p key={r.label} className="text-[14px] leading-relaxed">
                  <span className="text-[11px] uppercase tracking-[2px] text-or">{r.label}</span>
                  <br />
                  {r.list!.join(" · ")}
                </p>
              ))}
            </div>
          )}
        </motion.div>
      ) : (
        <motion.p {...up(1.05)} className="relative mt-6 max-w-[320px] text-[14px] leading-relaxed text-or-pale/90">
          {t("Le reste de cette fiche est réservé à la famille. Ouvrez-la avec l’application Nos Racines.")}
        </motion.p>
      )}
      <div className="relative mt-auto w-full pt-10">{footer}</div>
    </main>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-or/30 bg-white/5 px-3 py-1 text-[13px] text-coton/90">{children}</span>;
}

export function SharedTree({ card }: { card: TreeCard }) {
  // Les portraits arrivent un à un depuis l'espace en ligne de la famille.
  const dataV = useSyncExternalStore(subscribeData, getDataVersion);
  useEffect(() => {
    if (!card.fid || !card.ph) return;
    let stop = false;
    void (async () => {
      for (const mid of new Set(card.ph!.filter(Boolean))) {
        if (stop || mediaObjectUrl(mid)) continue;
        const b = await fetchPublicPhoto(card.fid!, mid);
        if (b && !stop) showMedia(mid, b);
      }
    })();
    return () => {
      stop = true;
    };
  }, [card]);
  void dataV;
  const layout = useMemo(() => {
    const { persons, unions, parentages } = treeFromCard(card);
    return layoutTree(persons, parentages, unions, new Set(), 390);
  }, [card]);
  return <TreeView layout={layout} mode="visiteur" familyName={card.f} />;
}

/** Pied de page de la page publique : le logo et le lien pour installer l'application. */
export function SharedFooter({ apkUrl }: { apkUrl?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Logo size={44} />
      <p className="font-serif text-[12px] tracking-[4px] text-or">NOS RACINES</p>
      <p className="max-w-[300px] text-[12px] leading-relaxed text-coton/60">{t("Les visages, les voix et les histoires de la famille.")}</p>
      {apkUrl && (
        <a href={apkUrl} className="mt-1 rounded-full border border-or/50 px-4 py-2 text-[13px] text-or-pale">
          {t("Installer l’application (Android)")}
        </a>
      )}
    </div>
  );
}
