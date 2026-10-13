"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { api, mediaUrl } from "@/lib/client";
import { MAP_H, MAP_W, project, SHAPES } from "@/lib/ci-map-data";
import { bearing, distanceKm, type Found } from "@/lib/geo";
import { useT } from "@/lib/i18n/client";
import { sound } from "@/lib/sound";
import { BottomNav } from "./BottomNav";
import { Portrait } from "./Portrait";
import { BackButton } from "./ui";

export interface MapMember {
  id: string;
  name: string;
  givenName: string;
  photoId?: string;
  isLiving: boolean;
  years?: string;
  originRaw?: string;
  origin: Found | null;
  homeRaw?: string;
  home: Found | null;
}

type Layer = "tout" | "racines" | "aujourdhui";
interface Spot {
  key: string;
  label: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
  members: MapMember[];
}

const PAD = 34; // marge autour du pays (étiquettes, départs vers l'étranger)
const VB = `${-PAD} ${-PAD} ${MAP_W + PAD * 2} ${MAP_H + PAD * 2}`;
const CI_CENTER = { lat: 7.6, lng: -5.5 };

// Repères pour s'orienter (discrets).
const LANDMARKS: [string, number, number][] = [
  ["Abidjan", 5.345, -4.024],
  ["Yamoussoukro", 6.82, -5.28],
  ["Bouaké", 7.69, -5.03],
  ["Korhogo", 9.46, -5.63],
  ["Man", 7.41, -7.55],
  ["San-Pédro", 4.75, -6.64],
  ["Daloa", 6.88, -6.45],
  ["Bondoukou", 8.04, -2.8],
  ["Odienné", 9.51, -7.56],
];
const NEIGHBORS: [string, number, number][] = [
  ["MALI", 10.95, -6.6],
  ["BURKINA FASO", 10.75, -3.6],
  ["GHANA", 7.4, -2.25],
  ["GUINÉE", 9.2, -8.75],
  ["LIBERIA", 6.0, -8.85],
];

const arc = (a: { x: number; y: number }, b: { x: number; y: number }, bend = 0.28) => {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Courbe toujours bombée vers le haut : un vol d'oiseau.
  const s = dx >= 0 ? -1 : 1;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${(mx + s * dy * bend).toFixed(1)} ${(my - Math.abs(dx) * bend - 8).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
};

export function CarteView({ familyName, familyVillage, familyOrigin, members, isAdmin }: { familyName: string; familyVillage?: string; familyOrigin: Found | null; members: MapMember[]; isAdmin: boolean }) {
  const t = useT();
  const [layer, setLayer] = useState<Layer>("tout");
  const [sel, setSel] = useState<{ title: string; sub: string; list: MapMember[] } | null>(null);
  const [placing, setPlacing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  // Zoom et déplacement (pincer, glisser, boutons + et −).
  const [view, setView] = useState({ z: 1, cx: MAP_W / 2, cy: MAP_H / 2 });
  const T = (p: { x: number; y: number }) => ({ x: (p.x - view.cx) * view.z + MAP_W / 2, y: (p.y - view.cy) * view.z + MAP_H / 2 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; d0?: number; z0?: number; last?: { x: number; y: number } }>({ moved: false });
  const unitsPerPx = () => (svgRef.current ? (MAP_W + PAD * 2) / svgRef.current.getBoundingClientRect().width : 1);
  const clampView = (v: { z: number; cx: number; cy: number }) => {
    const z = Math.min(6, Math.max(1, v.z));
    const half = { x: MAP_W / 2 / z, y: MAP_H / 2 / z };
    return { z, cx: Math.min(MAP_W - half.x + 10, Math.max(half.x - 10, v.cx)), cy: Math.min(MAP_H - half.y + 10, Math.max(half.y - 10, v.cy)) };
  };
  const zoomBy = (f: number) => setView((v) => clampView({ ...v, z: v.z * f }));
  const tap = (fn: () => void) => () => {
    if (!gesture.current.moved && !placing) fn();
  };

  const m = useMemo(() => {
    // Origine de chacun : son village, sinon celui de la famille.
    const originOf = (x: MapMember) => (x.origin?.kind === "ci" ? x.origin : familyOrigin?.kind === "ci" ? familyOrigin : null);
    const origins = new Map<string, Spot>();
    const homes = new Map<string, Spot>();
    const abroad = new Map<string, { country: string; places: Set<string>; members: MapMember[]; lat: number; lng: number }>();
    const flows = new Map<string, { from: Spot; to: Spot | null; abroadKey?: string; n: number }>();
    const add = (map: Map<string, Spot>, f: Found & { kind: "ci" }, label: string, who: MapMember) => {
      const key = `${f.lat.toFixed(2)},${f.lng.toFixed(2)}`;
      const cur = map.get(key) ?? { key, label, ...project(f.lat, f.lng), lat: f.lat, lng: f.lng, members: [] };
      if (!cur.members.includes(who)) cur.members.push(who);
      map.set(key, cur);
      return cur;
    };
    for (const x of members) {
      const o = originOf(x);
      const os = o ? add(origins, o, x.origin?.kind === "ci" ? x.origin.label : familyVillage ?? o.label, x) : null;
      if (!x.isLiving || !x.home) continue;
      if (x.home.kind === "ci") {
        const hs = add(homes, x.home, x.home.city, x);
        if (os && os.key !== hs.key) {
          const k = `${os.key}>${hs.key}`;
          flows.set(k, { from: os, to: hs, n: (flows.get(k)?.n ?? 0) + 1 });
        }
      } else {
        const a = abroad.get(x.home.country) ?? { country: x.home.country, places: new Set<string>(), members: [], lat: x.home.lat, lng: x.home.lng };
        a.places.add(x.home.label);
        a.members.push(x);
        abroad.set(x.home.country, a);
        if (os) {
          const k = `${os.key}>${x.home.country}`;
          flows.set(k, { from: os, to: null, abroadKey: x.home.country, n: (flows.get(k)?.n ?? 0) + 1 });
        }
      }
    }
    // Les pays lointains se posent au bord de la carte, dans leur direction.
    const c = project(CI_CENTER.lat, CI_CENTER.lng);
    const edge = [...abroad.values()].map((a) => {
      const b = (bearing(CI_CENTER, a) * Math.PI) / 180;
      const dx = Math.sin(b);
      const dy = -Math.cos(b);
      const k = Math.min((dx > 0 ? MAP_W + PAD - 14 - c.x : c.x + PAD - 14) / Math.abs(dx || 1e-6), (dy > 0 ? MAP_H + PAD - 14 - c.y : c.y + PAD - 14) / Math.abs(dy || 1e-6));
      return { ...a, x: c.x + dx * k, y: c.y + dy * k, km: distanceKm(CI_CENTER, a) };
    });
    const unplaced = new Set<string>();
    for (const x of members) {
      if (x.originRaw && !x.origin) unplaced.add(x.originRaw);
      if (x.homeRaw && !x.home) unplaced.add(x.homeRaw);
    }
    if (familyVillage && !familyOrigin) unplaced.add(familyVillage);
    const placedHome = members.filter((x) => x.isLiving && x.home).length;
    const far = edge.sort((a, b) => b.km - a.km)[0];
    return { origins: [...origins.values()], homes: [...homes.values()].sort((a, b) => b.members.length - a.members.length), abroad: edge, flows: [...flows.values()], unplaced: [...unplaced], placedHome, far };
  }, [members, familyOrigin, familyVillage]);

  const showRoots = layer !== "aujourdhui";
  const showToday = layer !== "racines";
  const living = members.filter((x) => x.isLiving).length;

  async function placeAt(e: React.PointerEvent<SVGSVGElement>) {
    if (!placing || !svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const q = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
    const p = { x: (q.x - MAP_W / 2) / view.z + view.cx, y: (q.y - MAP_H / 2) / view.z + view.cy };
    const K = 55.27;
    const C = Math.cos((7.5 * Math.PI) / 180);
    const lng = p.x / (C * K) - 9.2;
    const lat = 11.2 - p.y / K;
    setBusy(true);
    try {
      await api("/api/famille", "PATCH", { place: { name: placing, lat, lng } });
      sound.play("chime");
      setPlacing(null);
    } finally {
      setBusy(false);
    }
  }

  // Étiquettes : on n'en écrit pas une par-dessus une autre (les villages de la famille d'abord).
  const labels = (() => {
    const boxes: [number, number, number, number][] = [];
    const fits = (x: number, y: number, w: number, h: number) => {
      if (boxes.some(([a, b, c, d]) => x < a + c && x + w > a && y < b + d && y + h > b)) return false;
      boxes.push([x, y, w, h]);
      return true;
    };
    const reserve = (x: number, y: number, w: number, h: number) => void boxes.push([x, y, w, h]);
    return { fits, reserve };
  })();
  // Les ronds de la famille d'abord : aucune étiquette ne doit les couvrir.
  for (const o of m.origins) {
    const q = T(o);
    labels.reserve(q.x - 8, q.y - 8, 16, 16);
  }
  for (const h of m.homes) {
    const q = T(h);
    const r = 6 + Math.sqrt(h.members.length) * 3.2;
    labels.reserve(q.x - r, q.y - r, r * 2, r * 2);
  }

  return (
    <main className="relative min-h-dvh bg-nuit pb-28 text-coton">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(70%_60%_at_60%_30%,rgba(200,161,90,0.18),transparent_70%)]" />
      <header className="relative flex items-center gap-3 px-5 pb-2 pt-[52px]">
        <BackButton href="/accueil" dark />
        <div className="min-w-0 flex-1">
          <p className="font-main text-lg leading-none text-or">{familyName}</p>
          <h1 className="truncate font-serif text-[26px] font-light">{t("Notre terre")}</h1>
        </div>
      </header>

      <div role="tablist" className="relative mx-5 mt-2 flex rounded-full bg-white/5 p-1">
        {(
          [
            ["tout", t("Tout")],
            ["racines", t("Nos racines")],
            ["aujourdhui", t("Aujourd’hui")],
          ] as [Layer, string][]
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={layer === id} onClick={() => setLayer(id)} className="relative flex-1 rounded-full py-2 text-[13px]">
            {layer === id && <motion.span layoutId="map-tab" className="absolute inset-0 rounded-full bg-or" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
            <span className={`relative ${layer === id ? "font-semibold text-nuit" : "text-or-pale"}`}>{label}</span>
          </button>
        ))}
      </div>

      {placing && (
        <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="relative mx-5 mt-3 rounded-[14px] bg-or px-4 py-2.5 text-center text-[13px] font-semibold text-nuit">
          {t("Touchez la carte à l’endroit de « {lieu} »", { lieu: placing })}
          <button onClick={() => setPlacing(null)} className="ml-2 underline">
            {t("Annuler")}
          </button>
        </motion.p>
      )}

      <div className="relative mt-2 px-2">
        <svg
          ref={svgRef}
          viewBox={VB}
          className={`w-full touch-none select-none ${placing ? "cursor-crosshair" : ""}`}
          role="img"
          aria-label={t("Carte de la Côte d’Ivoire")}
          onPointerDown={(e) => {
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            gesture.current = { moved: false, last: { x: e.clientX, y: e.clientY } };
            if (pointers.current.size === 2) {
              const [a, b] = [...pointers.current.values()];
              gesture.current = { moved: true, d0: Math.hypot(a.x - b.x, a.y - b.y), z0: view.z };
            }
          }}
          onPointerMove={(e) => {
            if (!pointers.current.has(e.pointerId)) return;
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const g = gesture.current;
            if (pointers.current.size === 2 && g.d0) {
              const [a, b] = [...pointers.current.values()];
              setView((v) => clampView({ ...v, z: (g.z0 ?? 1) * (Math.hypot(a.x - b.x, a.y - b.y) / g.d0!) }));
            } else if (g.last) {
              const dx = e.clientX - g.last.x;
              const dy = e.clientY - g.last.y;
              if (Math.abs(dx) + Math.abs(dy) > 4) g.moved = true;
              if (g.moved && view.z > 1) {
                const u = unitsPerPx();
                setView((v) => clampView({ ...v, cx: v.cx - (dx * u) / v.z, cy: v.cy - (dy * u) / v.z }));
              }
              g.last = { x: e.clientX, y: e.clientY };
            }
          }}
          onPointerUp={(e) => {
            const wasTap = !gesture.current.moved;
            pointers.current.delete(e.pointerId);
            if (wasTap && placing && !busy) void placeAt(e);
          }}
          onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
        >
          <defs>
            <radialGradient id="civ-fill" cx="55%" cy="40%" r="75%">
              <stop offset="0%" stopColor="#2F5638" />
              <stop offset="100%" stopColor="#173322" />
            </radialGradient>
            <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#12261A" stopOpacity="0" />
              <stop offset="100%" stopColor="#0B1A2A" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="flow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#E6D3A3" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#C8A15A" />
            </linearGradient>
          </defs>

          <clipPath id="cadre">
            <rect x={-PAD} y={-PAD} width={MAP_W + PAD * 2} height={MAP_H + PAD * 2} rx="18" />
          </clipPath>
          <g clipPath="url(#cadre)">
          {/* Mer et quadrillage léger */}
          <rect x={-PAD} y={MAP_H * 0.72} width={MAP_W + PAD * 2} height={MAP_H * 0.28 + PAD} fill="url(#sea)" />
          {[0.2, 0.4, 0.6, 0.8].map((f) => (
            <g key={f} stroke="#C8A15A" strokeOpacity="0.05" strokeWidth="0.6">
              <line x1={-PAD} x2={MAP_W + PAD} y1={MAP_H * f} y2={MAP_H * f} />
              <line y1={-PAD} y2={MAP_H + PAD} x1={MAP_W * f} x2={MAP_W * f} />
            </g>
          ))}

          <g transform={`translate(${MAP_W / 2 - view.cx * view.z} ${MAP_H / 2 - view.cy * view.z}) scale(${view.z})`}>
          {/* Pays voisins */}
          {(["lbr", "gin", "mli", "bfa", "gha"] as const).map((k) => (
            <path key={k} d={SHAPES[k]} fill="#FFFFFF" fillOpacity="0.025" stroke="#C8A15A" strokeOpacity="0.16" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          ))}
          {NEIGHBORS.map(([n, lat, lng]) => {
            const p = project(lat, lng);
            return (
              <text key={n} x={p.x} y={p.y} textAnchor="middle" fontSize={7.5 / view.z} letterSpacing={2.5 / view.z} fill="#C8A15A" fillOpacity="0.35">
                {n}
              </text>
            );
          })}
          <text x={MAP_W * 0.55} y={MAP_H + 14} textAnchor="middle" fontSize={10 / view.z} fontStyle="italic" className="font-serif" fill="#E6D3A3" fillOpacity="0.4">
            {t("Golfe de Guinée")}
          </text>

          {/* La Côte d'Ivoire */}
          <motion.path d={SHAPES.civ} fill="url(#civ-fill)" stroke="#C8A15A" strokeWidth="1.3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" initial={{ pathLength: 0, fillOpacity: 0 }} animate={{ pathLength: 1, fillOpacity: 1 }} transition={{ pathLength: { duration: 2.2, ease: "easeInOut" }, fillOpacity: { duration: 1.4, delay: 0.8 } }} />
          <path d={SHAPES.civ} fill="none" stroke="#E6D3A3" strokeOpacity="0.12" strokeWidth={7 / view.z} strokeLinejoin="round" />
          </g>

          {/* Chemins de vie : du village à la ville d'aujourd'hui */}
          {showRoots &&
            showToday &&
            m.flows.map((f, i) => {
              const to = f.to ? T(f.to) : m.abroad.find((a) => a.country === f.abroadKey);
              if (!to) return null;
              const d = arc(T(f.from), to, f.to ? 0.28 : 0.12);
              return (
                <g key={i}>
                  <motion.path d={d} fill="none" stroke="url(#flow)" strokeWidth={1 + Math.min(3, f.n * 0.6)} strokeLinecap="round" strokeDasharray={f.to ? undefined : "3 4"} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.9 }} transition={{ delay: 1.6 + i * 0.25, duration: 1.6, ease: "easeInOut" }} />
                  <circle r="2.2" fill="#FFF3D6">
                    <animateMotion dur={`${3.2 + (i % 3) * 0.7}s`} begin={`${2.4 + i * 0.25}s`} repeatCount="indefinite" path={d} />
                    <animate attributeName="opacity" values="0;1;1;0" dur={`${3.2 + (i % 3) * 0.7}s`} begin={`${2.4 + i * 0.25}s`} repeatCount="indefinite" />
                  </circle>
                </g>
              );
            })}

          {/* Villages d'origine : la racine dorée */}
          {showRoots &&
            m.origins.map((o0, i) => {
              const o = { ...o0, ...T(o0) };
              const showLabel = labels.fits(o.x - o.label.length * 2.6, o.y - 21, o.label.length * 5.2, 11);
              return (
              <g key={o.key} onClick={tap(() => setSel({ title: o.label, sub: t("Village d’origine de {n} membre(s)", { n: o.members.length }), list: o.members }))} className="cursor-pointer">
                <circle cx={o.x} cy={o.y} r="6" fill="none" stroke="#C8A15A" strokeWidth="1.2">
                  <animate attributeName="r" values="6;20" dur="2.8s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0" dur="2.8s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                </circle>
                <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1.2 + i * 0.15, type: "spring", stiffness: 200, damping: 14 }} style={{ transformOrigin: `${o.x}px ${o.y}px` }}>
                  <circle cx={o.x} cy={o.y} r="7.5" fill="#C8A15A" stroke="#FFF3D6" strokeWidth="1.2" />
                  {/* Petit arbre */}
                  <path d={`M${o.x} ${o.y + 4}v-4m0 0l-2.6-2.4m2.6 2.4l2.6-2.4M${o.x} ${o.y}v-3.4`} stroke="#12261A" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                </motion.g>
                {showLabel && (
                  <text x={o.x} y={o.y - 12} textAnchor="middle" fontSize="9.5" className="font-serif" fill="#FFF3D6" stroke="#12261A" strokeWidth="2.5" paintOrder="stroke">
                    {o.label}
                  </text>
                )}
              </g>
              );
            })}

          {/* Où vit chacun aujourd'hui */}
          {showToday &&
            m.homes.map((h0, i) => {
              const h = { ...h0, ...T(h0) };
              const r = 6 + Math.sqrt(h.members.length) * 3.2;
              const below = labels.fits(h.x - h.label.length * 2.4, h.y + r + 2, h.label.length * 4.8, 10);
              const above = !below && labels.fits(h.x - h.label.length * 2.4, h.y - r - 12, h.label.length * 4.8, 10);
              return (
                <g key={h.key} onClick={tap(() => setSel({ title: h.label, sub: t("{n} membre(s) y vivent", { n: h.members.length }), list: h.members }))} className="cursor-pointer">
                  <motion.circle cx={h.x} cy={h.y} r={r} fill="#FAF7F1" fillOpacity="0.92" stroke="#C8A15A" strokeWidth="1.5" initial={{ r: 0 }} animate={{ r }} transition={{ delay: 2 + i * 0.12, type: "spring", stiffness: 180, damping: 12 }} />
                  <text x={h.x} y={h.y + 3.4} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#12261A">
                    {h.members.length}
                  </text>
                  {(below || above) && (
                    <text x={h.x} y={below ? h.y + r + 10 : h.y - r - 4} textAnchor="middle" fontSize="8.5" fill="#FAF7F1" stroke="#12261A" strokeWidth="2.5" paintOrder="stroke">
                      {h.label}
                    </text>
                  )}
                </g>
              );
            })}

          {/* La famille à l'étranger, au bord de la carte dans sa direction */}
          {showToday &&
            m.abroad.map((a, i) => (
              <motion.g key={a.country} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4 + i * 0.2 }} onClick={tap(() => setSel({ title: a.country, sub: `${[...a.places].join(", ")} · ${a.km.toLocaleString()} km`, list: a.members }))} className="cursor-pointer">
                <rect x={a.x - 34} y={a.y - 10} width="68" height="20" rx="10" fill="#12261A" stroke="#C8A15A" strokeWidth="1" />
                <text x={a.x} y={a.y + 3.5} textAnchor="middle" fontSize="8.5" fill="#E6D3A3">
                  {a.country.length > 12 ? a.country.slice(0, 11) + "…" : a.country} · {a.members.length}
                </text>
              </motion.g>
            ))}

          {/* Repère discret d'Abidjan si personne n'y vit */}
          {/* Repères */}
          {LANDMARKS.map(([n, lat, lng]) => {
            const p = T(project(lat, lng));
            if (!labels.fits(p.x + 4, p.y - 5, n.length * 4.2, 9)) return null;
            return (
              <g key={n} opacity="0.55">
                <circle cx={p.x} cy={p.y} r="1.6" fill="#E6D3A3" />
                <text x={p.x + 4} y={p.y + 3} fontSize="7.5" fill="#E6D3A3" fillOpacity="0.7">
                  {n}
                </text>
              </g>
            );
          })}

          </g>
        </svg>
        <div className="absolute bottom-3 right-4 flex flex-col gap-1.5">
          {[
            ["+", () => zoomBy(1.6), t("Zoomer")],
            ["−", () => zoomBy(1 / 1.6), t("Dézoomer")],
          ].map(([l, f, a]) => (
            <button key={l as string} onClick={f as () => void} aria-label={a as string} className="flex h-9 w-9 items-center justify-center rounded-full border border-or/40 bg-nuit/80 text-[18px] text-or-pale backdrop-blur">
              {l as string}
            </button>
          ))}
          {view.z > 1 && (
            <button onClick={() => setView({ z: 1, cx: MAP_W / 2, cy: MAP_H / 2 })} aria-label={t("Voir tout le pays")} className="flex h-9 w-9 items-center justify-center rounded-full border border-or/40 bg-nuit/80 text-[13px] text-or-pale backdrop-blur">
              ⤢
            </button>
          )}
        </div>
      </div>

      {/* En chiffres */}
      <div className="relative mx-5 mt-1 grid grid-cols-3 gap-2 text-center">
        {[
          { n: m.origins.length, l: t("village(s) d’origine") },
          { n: m.homes.length, l: t("ville(s) aujourd’hui") },
          { n: m.abroad.length, l: t("pays à l’étranger") },
        ].map((s) => (
          <div key={s.l} className="rounded-[16px] border border-or/20 bg-white/5 px-2 py-3">
            <p className="font-serif text-[26px] leading-none text-or">{s.n}</p>
            <p className="mt-1 text-[11px] leading-tight text-or-pale">{s.l}</p>
          </div>
        ))}
      </div>
      {m.far && (
        <p className="relative mx-5 mt-3 text-center text-[13px] text-or-pale">
          {t("Le plus loin : {lieu}, à {km} km de la maison.", { lieu: [...m.far.places][0] ?? m.far.country, km: m.far.km.toLocaleString() })}
        </p>
      )}

      {/* La liste, pour tout voir d'un coup */}
      <section className="relative mx-5 mt-6">
        <h2 className="font-serif text-[20px]">{t("Où vit chacun")}</h2>
        {m.homes.length + m.abroad.length === 0 ? (
          <p className="mt-2 rounded-[16px] border border-dashed border-or/40 p-4 text-[13px] leading-relaxed text-or-pale">
            {t("Indiquez la « Ville actuelle » de chacun dans sa fiche (Modifier) : la carte se remplit toute seule.")}
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {[...m.homes.map((h) => ({ k: h.key, title: h.label, list: h.members })), ...m.abroad.map((a) => ({ k: a.country, title: `${[...a.places].join(", ")} (${a.country})`, list: a.members }))].map((g) => (
              <div key={g.k} className="rounded-[18px] border border-or/15 bg-white/5 p-3">
                <p className="text-[12px] uppercase tracking-[1.5px] text-or">{g.title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.list.map((x) => (
                    <Link key={x.id} href={`/membre/${x.id}`} className="flex items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-3 text-[13px]">
                      <Portrait size={28} src={mediaUrl(x.photoId)} />
                      {x.givenName}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[12px] text-or-pale/70">{t("{a} sur {b} membres vivants placés sur la carte.", { a: m.placedHome, b: living })}</p>
      </section>

      {isAdmin && m.unplaced.length > 0 && (
        <section className="relative mx-5 mt-6 rounded-[20px] border border-or/30 p-4">
          <h2 className="font-serif text-[18px]">{t("Lieux à placer")}</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-or-pale">{t("Ces villages ne sont pas dans la liste. Touchez « Placer », puis l’endroit exact sur la carte.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {m.unplaced.map((n) => (
              <button
                key={n}
                onClick={() => {
                  setPlacing(n);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`rounded-full border px-3 py-1.5 text-[13px] ${placing === n ? "border-or bg-or text-nuit" : "border-or/40 text-coton"}`}
              >
                {n} · {t("Placer")}
              </button>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {sel && (
          <motion.div key="sheet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setSel(null)}>
            <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} className="w-full max-w-[440px] rounded-t-[28px] bg-coton p-5 pb-8 text-ebene" onClick={(e) => e.stopPropagation()}>
              <p className="font-serif text-[22px] text-nuit">{sel.title}</p>
              <p className="text-[13px] text-or-fonce">{sel.sub}</p>
              <div className="mt-4 max-h-[45vh] space-y-2 overflow-y-auto">
                {sel.list.map((x) => (
                  <Link key={x.id} href={`/membre/${x.id}`} className="flex items-center gap-3 rounded-[14px] bg-white p-2.5">
                    <Portrait size={42} src={mediaUrl(x.photoId)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-[16px] text-nuit">{x.name}</span>
                      <span className="block text-[12px] text-[#6B6455]">{[x.years, x.homeRaw].filter(Boolean).join(" · ")}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <BottomNav />
    </main>
  );
}
