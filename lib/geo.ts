import { ABROAD, PLACES } from "./ci-map-data";

// Retrouve un lieu écrit à la main (« Cocody, Abidjan », « Toumodi », « Paris ») dans la liste
// des villes connues, ou parmi les lieux placés à la main sur la carte par la famille.

export type GeoPoint = { lat: number; lng: number };
export type Found =
  | { kind: "ci"; label: string; city: string; lat: number; lng: number }
  | { kind: "abroad"; label: string; country: string; lat: number; lng: number };

export const normPlace = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const CI = PLACES.map(([n, lat, lng, city]) => ({ n, key: normPlace(n), lat, lng, city: city ?? n }));
const WORLD = ABROAD.map(([n, lat, lng, country]) => ({ n, key: normPlace(n), lat, lng, country }));

export function findPlace(raw: string | undefined, custom: Record<string, GeoPoint> = {}): Found | null {
  if (!raw?.trim()) return null;
  const key = normPlace(raw);
  const own = custom[key];
  if (own) return { kind: "ci", label: raw.trim(), city: raw.trim(), ...own };
  const exact = CI.find((p) => p.key === key);
  if (exact) return { kind: "ci", label: exact.n, city: exact.city, lat: exact.lat, lng: exact.lng };
  const wExact = WORLD.find((p) => p.key === key);
  if (wExact) return { kind: "abroad", label: wExact.n, country: wExact.country, lat: wExact.lat, lng: wExact.lng };
  // Un nom connu à l'intérieur du texte (« Cocody, Abidjan ») : le plus précis gagne.
  const padded = ` ${key} `;
  const inCi = CI.filter((p) => padded.includes(` ${p.key} `)).sort((a, b) => b.key.length - a.key.length || Number(a.city === a.n) - Number(b.city === b.n));
  if (inCi[0]) return { kind: "ci", label: inCi[0].n, city: inCi[0].city, lat: inCi[0].lat, lng: inCi[0].lng };
  const inW = WORLD.filter((p) => padded.includes(` ${p.key} `)).sort((a, b) => b.key.length - a.key.length);
  if (inW[0]) return { kind: "abroad", label: inW[0].n, country: inW[0].country, lat: inW[0].lat, lng: inW[0].lng };
  for (const [k, g] of Object.entries(custom)) if (padded.includes(` ${k} `)) return { kind: "ci", label: raw.trim(), city: raw.trim(), ...g };
  return null;
}

/** Distance à vol d'oiseau, en km. */
export function distanceKm(a: GeoPoint, b: GeoPoint) {
  const R = 6371;
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Direction d'un lieu lointain vu depuis la Côte d'Ivoire (en degrés, 0 = nord). */
export function bearing(from: GeoPoint, to: GeoPoint) {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(to.lng - from.lng)) * Math.cos(r(to.lat));
  const x = Math.cos(r(from.lat)) * Math.sin(r(to.lat)) - Math.sin(r(from.lat)) * Math.cos(r(to.lat)) * Math.cos(r(to.lng - from.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Noms proposés pendant la saisie (villes de Côte d'Ivoire puis du monde). */
export const PLACE_SUGGESTIONS = [...PLACES.map((p) => (p[3] ? `${p[0]}, ${p[3]}` : p[0])), ...ABROAD.filter((a) => a[0] !== a[3]).map((a) => `${a[0]}, ${a[3]}`)];
