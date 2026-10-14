"use client";

import { animate, AnimatePresence, motion, useMotionValue } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";
import { mediaUrl } from "@/lib/client";
import { useT } from "@/lib/i18n/client";
import { sound } from "@/lib/sound";
import type { TreeLayout } from "@/lib/tree-layout";
import { Dust, Grain, Vignette } from "./ambiance";
import { BottomNav } from "./BottomNav";
import { Portrait } from "./Portrait";
import { LivingPortrait } from "./LivingPortrait";
import { EmptyState } from "./ui";

const RING = ["#C8A15A", "#9DB08A", "#8FB3B0", "#E6D3A3", "#D9B98A", "#C9A0A0"]; // une couleur par génération
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const ease = [0.2, 0.7, 0.2, 1] as const;
// Colombe (dessin 0–20), symbole de paix à côté des dates des défunts.
const DOVE = "M1 10.5c2.2-.9 4.3-.8 6.2.2.6-2.6 2.5-4.6 5.1-5.3-.9 1.1-1.3 2.2-1.3 3.3 1.5-.3 3.1.1 4.5 1.2.5-.6 1.3-.9 2.2-.8-.5.5-.8 1.1-.9 1.8-.3 2.4-2.3 4.3-5 4.6-2.6.3-5-.7-6.6-2.6-1.3.1-2.8-.3-4.2-1.4z";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function TreeView({ layout, mode, familyName, startId }: { layout: TreeLayout; mode: "admin" | "membre" | "visiteur"; familyName: string; startId?: string }) {
  const t = useT();
  const [selId, setSelId] = useState(startId && layout.nodes.some((n) => n.id === startId) ? startId : layout.nodes[0]?.id);
  // La fiche du bas se ferme pour voir et parcourir tout l'arbre.
  const [sheet, setSheet] = useState(!!startId);
  const [zoom, setZoom] = useState(1);
  const dx = useMotionValue(-Math.max(0, layout.width - 390) / 2);
  const dy = useMotionValue(0);
  const fitAll = () => {
    setSheet(false);
    const vw = Math.min(window.innerWidth, 440);
    const vh = window.innerHeight - 118 - 110;
    const z = Math.max(0.35, Math.min(1, (vw - 16) / layout.width, vh / layout.height));
    setZoom(z);
    void animate(dx, (vw - layout.width * z) / 2 - 195 * (1 - z), { type: "spring", stiffness: 120, damping: 20 });
    void animate(dy, 6 - 120 * (1 - z), { type: "spring", stiffness: 120, damping: 20 });
  };
  const [query, setQuery] = useState("");
  const sel = useMemo(() => layout.nodes.find((n) => n.id === selId), [layout, selId]);
  const matches = useMemo(() => (query.trim() ? new Set(layout.nodes.filter((n) => norm(`${n.name} ${n.sub}`).includes(norm(query))).map((n) => n.id)) : null), [query, layout]);
  const extra = Math.max(0, layout.width - 390);

  function search(v: string) {
    setQuery(v);
    const first = layout.nodes.find((n) => v.trim() && norm(`${n.name} ${n.sub}`).includes(norm(v)));
    if (first) setSelId(first.id);
  }

  if (!layout.nodes.length) {
    return (
      <main className="relative flex min-h-dvh flex-col bg-nuit text-coton">
        <Vignette />
        <Dust />
        <div className="relative flex flex-1 flex-col justify-center px-6">
          <EmptyState
            dark
            title={t("L’arbre attend sa première racine")}
            text={mode === "admin" ? t("Commencez par vous-même ou par l’ancêtre le plus lointain que vous connaissez.") : t("Les administrateurs n’ont encore ajouté personne.")}
            action={mode === "admin" && <Link href="/personne/nouvelle" className="flex min-h-12 items-center justify-center rounded-full bg-or font-semibold text-nuit">{t("Ajouter une personne")}</Link>}
          />
        </div>
        {mode !== "visiteur" && <BottomNav />}
      </main>
    );
  }

  const ficheHref = sel ? (mode === "visiteur" ? (sel.isPublic ? `/q/${sel.qrCode}` : null) : `/membre/${sel.id}`) : null;

  return (
    <main className="relative h-dvh overflow-hidden bg-nuit text-coton">
      <Vignette glow="rgba(200,161,90,0.13)" at="50% 30%" />
      <Dust />

      <header className="absolute inset-x-0 top-0 z-20 px-4 pt-[52px]">
        <div className="flex items-center gap-2.5">
          {mode !== "visiteur" && (
            <Link href="/accueil" aria-label={t("Retour à l’accueil")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-or-pale/20 bg-coton/10 backdrop-blur-md">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E6D3A3" strokeWidth="1.8" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
            </Link>
          )}
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-or-pale/20 bg-coton/10 px-3.5 backdrop-blur-md">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E6D3A3" strokeWidth="1.8" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M16 16l5 5" /></svg>
            <span className="sr-only">{t("Rechercher")}</span>
            <input type="search" value={query} onChange={(e) => search(e.target.value)} placeholder={t("Nom, village, métier…")} className="min-w-0 flex-1 bg-transparent text-sm text-coton outline-none placeholder:text-or-pale/60" />
          </label>
          {mode === "admin" && (
            <Link href="/personne/nouvelle" aria-label={t("Ajouter une personne")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-or shadow-or">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12261A" strokeWidth="2.2" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
            </Link>
          )}
        </div>
        {mode === "visiteur" && <p className="mt-2 text-center font-main text-xl text-or-pale">{familyName}</p>}
      </header>

      {/* Canevas : déplacement au doigt, zoom fluide. */}
      <motion.div
        className="absolute left-0 top-[118px] cursor-grab touch-none active:cursor-grabbing"
        style={{ width: layout.width, height: layout.height, transformOrigin: "195px 120px", x: dx, y: dy }}
        onTap={(e) => {
          // Toucher le fond (pas un portrait) ferme la fiche.
          if (!(e.target as HTMLElement).closest?.("button")) setSheet(false);
        }}
        drag
        dragConstraints={{ left: -extra - 140, right: 140, top: -Math.max(0, layout.height - 380), bottom: 120 }}
        dragElastic={0.15}
        animate={{ scale: zoom }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
      >
        <motion.div className="relative h-full w-full" animate={{ rotate: [-0.4, 0.4, -0.4] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: `${layout.width / 2}px ${layout.height}px` }}>
          <svg width={layout.width} height={layout.height} role="img" aria-label={t("Arbre généalogique de la famille")} className="absolute inset-0 overflow-visible">
            {layout.rowsY.map((y, i) => (
              <g key={y}>
                <line x1="34" x2={layout.width} y1={y} y2={y} stroke="rgba(230,211,163,0.06)" />
                <text x={12 + extra / 2} y={y + 5} className="font-serif" fontSize="13" fill="rgba(230,211,163,0.55)">{ROMAN[i]}</text>
              </g>
            ))}
            {layout.links.map((l) => (
              <g key={l.id}>
                <motion.path d={l.d} fill="none" stroke={l.kind === "union" ? (l.separated ? "rgba(200,161,90,0.75)" : "#C8A15A") : "rgba(200,161,90,0.65)"} strokeWidth={l.kind === "union" ? (l.separated ? 2 : 1.5) : 1.25} strokeLinecap="round" strokeDasharray={l.kind === "fostered" ? "3 4" : l.separated ? "1.5 5" : undefined}
                  // Le tracé animé efface les pointillés : les liens en pointillés apparaissent en fondu.
                  initial={l.kind === "fostered" || l.separated ? { opacity: 0 } : { pathLength: 0 }}
                  animate={l.kind === "fostered" || l.separated ? { opacity: 1 } : { pathLength: 1 }}
                  transition={{ delay: l.delay, duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
                />
                {l.kind === "child" && <path d={l.d} className="nr-sap" fill="none" stroke="#FFE3A6" strokeWidth="2.5" strokeLinecap="round" style={{ animationDelay: `${2 + l.delay * 2}s` }} />}
                {l.kind === "union" && l.separated && l.sepYear && l.label && (
                  <text x={l.label.x} y={l.label.y - (l.rank ? 10 : 0)} textAnchor="middle" fontSize="8" fill="rgba(230,211,163,0.75)">{l.sepYear}</text>
                )}
                {l.kind === "union" && l.rank && l.label && (
                  <text x={l.label.x} y={l.label.y} textAnchor="middle" fontSize="9" fill="#C8A15A">{l.rank === 1 ? t("1re") : t("{n}e", { n: l.rank })}</text>
                )}
              </g>
            ))}

            {sel && (
              <>
                <motion.circle initial={{ cx: sel.x, cy: sel.y, r: sel.r + 10 }} animate={{ cx: sel.x, cy: sel.y, r: sel.r + 10 }} transition={{ type: "spring", stiffness: 90, damping: 16 }} className="nr-halo" fill="rgba(200,161,90,0.25)" />
                <motion.circle initial={{ cx: sel.x, cy: sel.y, r: sel.r + 6 }} animate={{ cx: sel.x, cy: sel.y, r: sel.r + 6 }} transition={{ type: "spring", stiffness: 90, damping: 16 }} fill="none" stroke="#FFE3A6" strokeWidth="1.5" strokeDasharray="3 3" />
              </>
            )}

          </svg>
          {/* Portraits : en HTML (images, prénoms, dates) pour un affichage fiable sur tous les téléphones. */}
          {layout.nodes.map((n, i) => {
            const dim = matches && !matches.has(n.id);
            const size = n.r * 2;
            return (
              <motion.button
                key={n.id}
                data-silent
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  if (n.id !== selId || !sheet) sound.play("chime");
                  setSelId(n.id);
                  setSheet(true);
                }}
                aria-label={n.name}
                aria-pressed={n.id === selId}
                className="absolute flex w-[84px] flex-col items-center"
                style={{ left: n.x - 42, top: n.y - n.r, originY: `${n.r}px` }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: dim ? 0.25 : 1, y: [0, -3, 0] }}
                transition={{
                  scale: { delay: 0.1 + n.generation * 0.4 + i * 0.03, type: "spring", stiffness: 260, damping: 14 },
                  opacity: { duration: 0.4 },
                  y: { delay: 3 + i * 0.3, duration: 5, repeat: Infinity, ease: "easeInOut" },
                }}
              >
                <span
                  className="relative flex items-center justify-center rounded-full"
                  style={{
                    width: size,
                    height: size,
                    background: n.placeholder ? "rgba(230,211,163,0.04)" : n.isLiving ? "#1F3D2B" : "#2A2016",
                    border: n.placeholder ? "1.4px dashed rgba(230,211,163,0.55)" : `2.2px solid ${RING[(n.generation - 1) % RING.length]}`,
                  }}
                >
                  {n.placeholder ? (
                    <span className="font-serif text-or-pale/70" style={{ fontSize: n.r * 0.85 }}>?</span>
                  ) : n.photoId && n.animated ? (
                    <LivingPortrait src={mediaUrl(n.photoId)!} className="h-full w-full rounded-full" filter="sepia(.7) grayscale(.25)" intensity={0.6} />
                  ) : n.photoId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(n.photoId)} alt="" draggable={false} className="h-full w-full rounded-full object-cover" style={{ filter: n.isLiving ? "sepia(.25)" : "sepia(.7) grayscale(.25)" }} />
                  ) : (
                    <span className="font-serif text-or-pale" style={{ fontSize: n.r * 0.6 }}>{n.initials}</span>
                  )}
                  {n.hasVoice && (
                    <span className="absolute -right-1 -top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-or">
                      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden><path d="M2 3.5v3M5 1.5v7M8 4v2" stroke="#12261A" strokeWidth="1.4" /></svg>
                    </span>
                  )}
                  {n.anniv && (
                    <span className={`absolute -left-1 -top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-or ${n.anniv === "birth" ? "bg-or-pale" : "bg-[#2A2016]"}`}>
                      {n.anniv === "birth" ? (
                        <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden><path d="M12 2l2.6 6.2 6.6.6-5 4.4 1.5 6.6L12 16.4 6.3 19.8l1.5-6.6-5-4.4 6.6-.6z" fill="#8A6A2E" /></svg>
                      ) : (
                        <svg width="8" height="10" viewBox="0 0 8 10" aria-hidden><path d="M4 0c2.6 3 3.4 5.2 1.8 7.4-.9 1.2-2.7 1.2-3.6 0C.6 5.2 1.4 3 4 0z" fill="#FFD27A" /></svg>
                      )}
                    </span>
                  )}
                </span>
                <span className={`mt-1 max-w-[84px] truncate text-[10px] leading-tight ${n.placeholder ? "italic text-or-pale/60" : "text-coton"} ${n.id === selId ? "font-semibold" : ""}`}>
                  {n.givenName}
                </span>
                {n.years && (
                  // Dates d'un défunt, discrètes, avec une colombe.
                  <span className="flex items-center gap-[3px] text-[8px] leading-tight text-or-pale/80" style={{ fontVariantNumeric: "tabular-nums" }}>
                    <svg width="10" height="10" viewBox="0 0 20 20" aria-hidden><path d={DOVE} fill="#E6D3A3" /></svg>
                    {n.years}
                  </span>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </motion.div>

      <Grain opacity={0.08} />

      <div className="absolute right-4 top-[330px] z-20 flex flex-col gap-2">
        {[
          { l: t("Zoomer"), d: "M12 5v14M5 12h14", f: () => setZoom((z) => Math.min(1.8, z + 0.2)) },
          { l: t("Dézoomer"), d: "M5 12h14", f: () => setZoom((z) => Math.max(0.35, z - 0.2)) },
          { l: t("Voir tout l’arbre"), d: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5", f: fitAll },
        ].map((b) => (
          <button key={b.l} onClick={b.f} aria-label={b.l} className="flex h-11 w-11 items-center justify-center rounded-full border border-or-pale/25 bg-coton/10 backdrop-blur-md">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E6D3A3" strokeWidth="2" aria-hidden><path d={b.d} /></svg>
          </button>
        ))}
      </div>

      {!sheet && sel && (
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className={`pointer-events-none absolute inset-x-0 z-20 text-center text-[11px] text-or-pale/70 ${mode === "visiteur" ? "bottom-6" : "bottom-[104px]"}`}>
          {t("Touchez un portrait pour ouvrir sa fiche")}
        </motion.p>
      )}
      <AnimatePresence>
      {sel && sheet && (
        <motion.section
          key="sheet"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0, transition: { duration: 0.35 } }}
          transition={{ duration: 0.6, ease }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={(_, info) => info.offset.y > 60 && setSheet(false)}
          className={`absolute inset-x-3 z-30 rounded-[28px] border border-or/35 bg-foret/80 px-5 pb-5 pt-3 shadow-[0_-8px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl ${mode === "visiteur" ? "bottom-4" : "bottom-[96px]"}`}
        >
          <div className="relative">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-or-pale/40" />
            <button onClick={() => setSheet(false)} aria-label={t("Fermer la fiche")} className="absolute -right-2 -top-1 flex h-9 w-9 items-center justify-center rounded-full bg-coton/10 text-or-pale">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={sel.id} initial={{ opacity: 0, y: 10, filter: "blur(3px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(3px)" }} transition={{ duration: 0.4, ease }} className="flex items-center gap-3.5">
              <Portrait size={60} src={mediaUrl(sel.photoId)} />
              <div className="min-w-0">
                <div className="truncate font-serif text-[21px]">{sel.name}</div>
                <div className="truncate text-[13px] text-or-pale">{sel.placeholder ? t("Case à compléter : touchez « Compléter »") : sel.sub || t("Génération {g}", { g: ROMAN[sel.generation - 1] })}</div>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className={`mt-4 grid gap-2 ${mode === "admin" ? "grid-cols-3" : "grid-cols-1"}`}>
            {sel.placeholder && mode === "admin" ? (
              <Link href={`/membre/${sel.id}/modifier`} className="flex min-h-12 items-center justify-center rounded-[14px] bg-or text-[13px] font-semibold text-nuit">{t("Compléter")}</Link>
            ) : ficheHref ? (
              <Link href={!sel.isLiving && mode !== "visiteur" ? `/memorial/${sel.id}` : ficheHref} className="flex min-h-12 items-center justify-center rounded-[14px] bg-or text-[13px] font-semibold text-nuit">
                {!sel.isLiving && mode !== "visiteur" ? t("Mémorial") : t("Voir sa fiche")}
              </Link>
            ) : (
              <p className="flex min-h-12 items-center justify-center rounded-[14px] border border-or-pale/30 text-center text-[12px] text-or-pale">{t("Fiche réservée à la famille")}</p>
            )}
            {mode === "admin" && (
              <>
                <Link href={`/personne/nouvelle?de=${sel.id}`} className="flex min-h-12 items-center justify-center rounded-[14px] border border-or-pale/35 px-1 text-center text-[12px] leading-tight">{t("+ Proche")}</Link>
                <Link href={`/membre/${sel.id}/modifier`} className="flex min-h-12 items-center justify-center rounded-[14px] border border-or-pale/35 text-[13px]">{t("Modifier")}</Link>
              </>
            )}
          </div>
        </motion.section>
      )}
      </AnimatePresence>
      {mode !== "visiteur" && (
        <div className="absolute inset-x-0 bottom-0 z-40">
          <BottomNav />
        </div>
      )}
    </main>
  );
}
