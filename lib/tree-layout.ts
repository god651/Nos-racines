import { computeGenerations } from "./genealogy";
import { initials, type Parentage, type Person, type Union } from "./types";

// Calcule la position de chaque portrait et le tracé des liens de l'arbre.
// Une rangée par génération ; chaque enfant se place sous le foyer de ses parents ;
// l'arbre s'élargit tout seul quand une génération compte beaucoup de monde.

export interface NodeInfo {
  id: string;
  name: string;
  givenName: string;
  initials: string;
  sub: string;
  photoId?: string;
  isLiving: boolean;
  hasVoice: boolean;
  isPublic: boolean;
  qrCode: string;
  generation: number;
  placeholder: boolean;
  animated: boolean;
  /** Dates d'un défunt, affichées sous son portrait avec la colombe. */
  years?: string;
  /** Anniversaire dans les 7 jours. */
  anniv?: "birth" | "death";
}

export interface NodePos extends NodeInfo {
  x: number;
  y: number;
  r: number;
}

export interface Link {
  id: string;
  d: string;
  kind: "union" | "child" | "fostered";
  rank?: number;
  label?: { x: number; y: number };
  delay: number;
}

export interface TreeLayout {
  nodes: NodePos[];
  links: Link[];
  width: number;
  height: number;
  rowsY: number[];
}

const ROW_GAP = 124;
const TOP = 52;
const RADIUS = [27, 23, 21, 19, 17, 16];
const MIN_GAP = 70;
const EDGE = 64; // place pour les numéros de génération à gauche

export function layoutTree(persons: Person[], parentages: Parentage[], unions: Union[], voiceIds: Set<string>, minWidth = 390, annivs: Map<string, "birth" | "death"> = new Map()): TreeLayout {
  const gens = computeGenerations(persons, parentages, unions);
  const rows = new Map<number, Person[]>();
  for (const p of persons) {
    const g = gens.get(p.id) ?? 1;
    rows.set(g, [...(rows.get(g) ?? []), p]);
  }
  const widest = Math.max(1, ...[...rows.values()].map((r) => r.length));
  const width = Math.max(minWidth, EDGE * 2 + (widest - 1) * MIN_GAP + 20);

  const parentsOf = new Map(parentages.map((pa) => [pa.childId, pa.parentIds]));
  const spouseOf = new Map<string, string[]>();
  for (const u of unions) {
    spouseOf.set(u.partnerA, [...(spouseOf.get(u.partnerA) ?? []), u.partnerB]);
    spouseOf.set(u.partnerB, [...(spouseOf.get(u.partnerB) ?? []), u.partnerA]);
  }

  const childrenOf = new Map<string, string[]>();
  for (const pa of parentages) for (const par of pa.parentIds) childrenOf.set(par, [...(childrenOf.get(par) ?? []), pa.childId]);
  const byId = new Map(persons.map((p) => [p.id, p]));

  // Quand deux lignées se marient, celle qui est arrivée en dernier dans l'arbre (ou dont les parents
  // sont « à compléter ») vient s'asseoir à côté de l'autre : le conjoint se place près de son époux,
  // et ses parents au-dessus de lui (seconde passe).
  const lineage = (id: string) => {
    const ps = parentsOf.get(id) ?? [];
    if (!ps.length) return -1;
    if (ps.some((x) => byId.get(x)?.placeholder)) return Infinity;
    return Math.min(...ps.map((x) => byId.get(x)?.createdAt ?? 0));
  };
  const attachedTo = (id: string) => {
    if (!(parentsOf.get(id) ?? []).length) return undefined;
    return (spouseOf.get(id) ?? []).find((sp) => (parentsOf.get(sp) ?? []).length && lineage(id) > lineage(sp));
  };
  const first = place(null);
  const hint = new Map<string, number>();
  for (const p of persons) {
    if ((parentsOf.get(p.id) ?? []).length) continue;
    const targets = (childrenOf.get(p.id) ?? []).filter((c) => attachedTo(c) && first.has(c)).map((c) => first.get(c)!.x);
    if (targets.length) hint.set(p.id, targets.reduce((a, b) => a + b, 0) / targets.length);
  }
  const pos = hint.size ? place(hint) : first;

  function place(hint: Map<string, number> | null) {
  const pos = new Map<string, NodePos>();
  for (const g of [...rows.keys()].sort((a, b) => a - b)) {
    const list = rows.get(g)!.sort((a, b) => a.createdAt - b.createdAt);
    const y = TOP + (g - 1) * ROW_GAP;
    const r = RADIUS[g - 1] ?? 16;

    // 1. Position souhaitée : sous le foyer des parents ; un conjoint « venu d'ailleurs » se place à côté de son conjoint.
    const wanted = list.map((p, i) => {
      const ps = (parentsOf.get(p.id) ?? []).map((id) => pos.get(id)).filter(Boolean) as NodePos[];
      let x = hint ? first.get(p.id)?.x ?? width / 2 : width / 2 + (i - (list.length - 1) / 2) * 100;
      if (hint?.has(p.id)) x = hint.get(p.id)!;
      if (ps.length) x = ps.reduce((s, q) => s + q.x, 0) / ps.length;
      return { p, x };
    });
    for (const w of wanted) {
      const att = attachedTo(w.p.id);
      if (!(parentsOf.get(w.p.id) ?? []).length || att) {
        const partner = att
          ? wanted.find((z) => z.p.id === att)
          : (spouseOf.get(w.p.id) ?? []).map((id) => wanted.find((z) => z.p.id === id)).find((z) => z && (parentsOf.get(z.p.id) ?? []).length);
        if (partner) w.x = partner.x + (w.p.sex === "f" ? 1 : -1) * 60;
      }
    }
    // Même foyer : les enfants du plus âgé au plus jeune.
    wanted.sort((a, b) => a.x - b.x || (a.p.birthYear ?? 9999) - (b.p.birthYear ?? 9999) || a.p.createdAt - b.p.createdAt);

    // Les frères et sœurs se répartissent de part et d'autre du foyer de leurs parents ;
    // celui qui a épousé quelqu'un d'une autre lignée se met au bord, du côté où son conjoint viendra,
    // et ce conjoint se colle à lui. On range ensuite les groupes sans jamais les mélanger.
    const spouseSide = (w: (typeof wanted)[number]) => {
      const sp = (spouseOf.get(w.p.id) ?? []).find((x) => attachedTo(x) === w.p.id);
      return sp ? (byId.get(sp)?.sex === "f" ? 1 : -1) : 0;
    };
    const order = new Map<string, { key: number; off: number }>();
    const groups = new Map<number, typeof wanted>();
    for (const w of wanted) {
      if (attachedTo(w.p.id) && wanted.some((z) => z.p.id === attachedTo(w.p.id))) continue;
      const k = Math.round(w.x);
      groups.set(k, [...(groups.get(k) ?? []), w]);
    }
    for (const [k, g] of groups) {
      g.sort((a, b) => spouseSide(a) - spouseSide(b) || (a.p.birthYear ?? 9999) - (b.p.birthYear ?? 9999) || a.p.createdAt - b.p.createdAt);
      g.forEach((w, i) => order.set(w.p.id, { key: k, off: i - (g.length - 1) / 2 }));
    }
    for (const w of wanted) {
      const att = attachedTo(w.p.id);
      const po = att ? order.get(att) : undefined;
      if (po) order.set(w.p.id, { key: po.key, off: po.off + (w.p.sex === "f" ? 0.5 : -0.5) });
    }
    wanted.sort((a, b) => order.get(a.p.id)!.key - order.get(b.p.id)!.key || order.get(a.p.id)!.off - order.get(b.p.id)!.off);
    for (const w of wanted) {
      const o = order.get(w.p.id)!;
      w.x = o.key + o.off * MIN_GAP;
    }

    // 2. On écarte les portraits trop proches, puis on garde la rangée dans la largeur.
    for (let i = 1; i < wanted.length; i++) wanted[i].x = Math.max(wanted[i].x, wanted[i - 1].x + MIN_GAP);
    const over = wanted.length ? wanted[wanted.length - 1].x - (width - EDGE + 20) : 0;
    if (over > 0) wanted.forEach((w) => (w.x -= over));
    const under = wanted.length ? EDGE - wanted[0].x : 0;
    if (under > 0) wanted.forEach((w) => (w.x += under));

    for (const { p, x } of wanted) {
      pos.set(p.id, {
        id: p.id,
        name: `${p.givenName} ${p.familyName}`.trim(),
        givenName: p.givenName,
        initials: initials(p),
        sub: [p.birthYear ? (p.deathYear ? `${p.birthYear} – ${p.deathYear}` : `${p.birthYear}`) : "", p.job, p.city ?? p.village].filter(Boolean).join(" · "),
        photoId: p.photoId,
        isLiving: p.isLiving,
        hasVoice: voiceIds.has(p.id),
        isPublic: p.visibility === "public",
        qrCode: p.qrCode,
        generation: g,
        placeholder: !!p.placeholder,
        animated: !p.isLiving && p.animatePortrait !== false,
        years: !p.isLiving && (p.birthYear || p.deathYear) ? `${p.birthYear ?? "?"} – ${p.deathYear ?? "?"}` : undefined,
        anniv: annivs.get(p.id),
        x: Math.round(x),
        y,
        r,
      });
    }
  }

    return pos;
  }

  const links: Link[] = [];
  for (const u of unions) {
    const a = pos.get(u.partnerA);
    const b = pos.get(u.partnerB);
    if (!a || !b) continue;
    const [l, r] = a.x < b.x ? [a, b] : [b, a];
    const d = a.y === b.y ? `M${l.x + l.r} ${l.y} H${r.x - r.r}` : `M${l.x} ${l.y} L${r.x} ${r.y}`;
    links.push({ id: u.id, d, kind: "union", rank: u.rank, label: { x: (l.x + r.x) / 2, y: l.y - 8 }, delay: 0.3 });
  }
  for (const pa of parentages) {
    const child = pos.get(pa.childId);
    const parents = pa.parentIds.map((id) => pos.get(id)).filter(Boolean) as NodePos[];
    if (!child || !parents.length) continue;
    const sx = parents.reduce((s, p) => s + p.x, 0) / parents.length;
    const sy = parents.length > 1 && parents[0].y === parents[1].y ? parents[0].y : parents[0].y + parents[0].r;
    const midY = Math.round((sy + child.y - child.r) / 2 + 10);
    links.push({ id: `${pa.parentIds.join("-")}>${pa.childId}`, d: `M${sx} ${sy} V${midY} H${child.x} V${child.y - child.r}`, kind: pa.kind === "biological" ? "child" : "fostered", delay: 0.4 + child.generation * 0.35 });
  }

  const rowsY = [...new Set([...pos.values()].map((p) => p.y))].sort((a, b) => a - b);
  const height = (rowsY[rowsY.length - 1] ?? TOP) + 70;
  return { nodes: [...pos.values()], links, width, height, rowsY };
}
