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
  /** Couple séparé : le lien est en pointillés (et l'année de séparation). */
  separated?: boolean;
  sepYear?: number;
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

const ROW_GAP = 176;
const TOP = 52;
const RADIUS = [27, 23, 21, 19, 17, 16];
const MIN_GAP = 104;
const EDGE = 64; // place pour les numéros de génération à gauche

export function layoutTree(persons: Person[], parentages: Parentage[], unions: Union[], voiceIds: Set<string>, minWidth = 390, annivs: Map<string, "birth" | "death"> = new Map()): TreeLayout {
  const gens = computeGenerations(persons, parentages, unions);
  const rows = new Map<number, Person[]>();
  for (const p of persons) {
    const g = gens.get(p.id) ?? 1;
    rows.set(g, [...(rows.get(g) ?? []), p]);
  }
  const parentsOf = new Map(parentages.map((pa) => [pa.childId, pa.parentIds.filter((x) => gens.has(x))]));
  const spouseOf = new Map<string, string[]>();
  for (const u of unions) {
    if (!gens.has(u.partnerA) || !gens.has(u.partnerB)) continue;
    spouseOf.set(u.partnerA, [...(spouseOf.get(u.partnerA) ?? []), u.partnerB]);
    spouseOf.set(u.partnerB, [...(spouseOf.get(u.partnerB) ?? []), u.partnerA]);
  }
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const unionOf = new Map(unions.map((u) => [pairKey(u.partnerA, u.partnerB), u]));
  const childrenOf = new Map<string, string[]>();
  for (const pa of parentages) for (const par of pa.parentIds) if (gens.has(par)) childrenOf.set(par, [...(childrenOf.get(par) ?? []), pa.childId]);
  const byId = new Map(persons.map((p) => [p.id, p]));
  const gen = (id: string) => gens.get(id) ?? 1;
  const hasParents = (id: string) => (parentsOf.get(id) ?? []).length > 0;
  const age = (id: string) => {
    const p = byId.get(id)!;
    return [p.birthYear ?? 9999, p.createdAt] as const;
  };
  const byAge = (a: string, b: string) => age(a)[0] - age(b)[0] || age(a)[1] - age(b)[1];

  // ── Rangement par « foyers » ──────────────────────────────────────────
  // Un foyer = une personne + son ou ses conjoints, toujours côte à côte.
  // Sous chaque foyer, ses enfants (du plus âgé au plus jeune), chacun avec son propre foyer.
  // Les sous-arbres sont posés l'un à côté de l'autre sans jamais se chevaucher (contours par rangée).
  // Les parents d'un conjoint venu d'une autre famille se placent au-dessus de lui, sur le côté.
  type Contour = Map<number, [number, number]>;
  interface Sub { xs: Map<string, number>; contour: Contour; anchor: number }
  const visited = new Set<string>();

  // Une descendance contient-elle un mariage avec une autre lignée (dont les parents sont dans l'arbre) ?
  const inlawMemo = new Map<string, boolean>();
  const marriesInlaw = (id: string) => (spouseOf.get(id) ?? []).some((sp) => hasParents(sp) && gen(sp) === gen(id) && !(parentsOf.get(sp) ?? []).some((x) => (parentsOf.get(id) ?? []).includes(x)));
  const hasInlaw = (id: string, depth = 0): boolean => {
    if (inlawMemo.has(id)) return inlawMemo.get(id)!;
    if (depth > 30) return false;
    const v = marriesInlaw(id) || (childrenOf.get(id) ?? []).some((c) => hasInlaw(c, depth + 1));
    inlawMemo.set(id, v);
    return v;
  };

  const mergeContour = (into: Contour, from: Contour, dx: number) => {
    for (const [g, [l, r]] of from) {
      const cur = into.get(g);
      into.set(g, cur ? [Math.min(cur[0], l + dx), Math.max(cur[1], r + dx)] : [l + dx, r + dx]);
    }
  };
  /** Décalage minimal pour poser `sub` à droite (side 1) ou à gauche (side -1) de `acc` sans chevauchement. */
  const clearance = (acc: Contour, sub: Contour, side: 1 | -1, gap: number) => {
    let need = side === 1 ? -Infinity : Infinity;
    for (const [g, [l, r]] of sub) {
      const c = acc.get(g);
      if (!c) continue;
      if (side === 1) need = Math.max(need, c[1] + gap - l);
      else need = Math.min(need, c[0] - gap - r);
    }
    return need;
  };

  function layoutUnit(pid: string, side: 1 | -1): Sub {
    visited.add(pid);
    // Conjoints du même rang, pas encore placés.
    const spouses = (spouseOf.get(pid) ?? []).filter((s) => !visited.has(s) && gen(s) === gen(pid));
    spouses.forEach((s) => visited.add(s));
    // Le conjoint dont la famille est dans l'arbre se met du côté où viendra sa famille ;
    // sinon l'homme à gauche, la femme à droite.
    const inlawSp = spouses.filter((s) => hasParents(s));
    const otherSp = spouses.filter((s) => !hasParents(s));
    let members: string[];
    if (spouses.length === 1) {
      const s = spouses[0];
      const sRight = inlawSp.length ? side === 1 : byId.get(s)?.sex === "f" || (byId.get(s)?.sex === byId.get(pid)?.sex);
      members = sRight ? [pid, s] : [s, pid];
    } else if (spouses.length > 1) {
      // Plusieurs unions : la 1re épouse (ou l'union en cours) juste à côté, les suivantes ensuite,
      // en alternant les côtés ; les ex-conjoints (séparés) au bout. Un conjoint venu d'une famille
      // présente dans l'arbre reste du côté où sa famille sera placée.
      const u = (sp: string) => unionOf.get(pairKey(pid, sp));
      const ordered = [...spouses].sort(
        (a, b) =>
          Number(!!u(a)?.separated) - Number(!!u(b)?.separated) ||
          Number(!hasParents(a)) - Number(!hasParents(b)) ||
          (u(a)?.rank ?? 99) - (u(b)?.rank ?? 99) ||
          byAge(a, b),
      );
      const near = ordered.filter((_, i) => i % 2 === 0);
      const far = ordered.filter((_, i) => i % 2 === 1);
      members = side === 1 ? [...far.reverse(), pid, ...near] : [...near.reverse(), pid, ...far];
    } else members = [pid];

    // Enfants, groupés sous le bon couple, dans l'ordre des membres du foyer.
    const allKids = new Set<string>();
    for (const m of members) for (const c of childrenOf.get(m) ?? []) if (!visited.has(c) && gen(c) > gen(pid)) allKids.add(c);
    const groupKey = (c: string) => {
      const ps = (parentsOf.get(c) ?? []).filter((x) => members.includes(x));
      return ps.reduce((s, x) => s + members.indexOf(x), 0) / Math.max(1, ps.length);
    };
    const kids = [...allKids].sort((a, b) => groupKey(a) - groupKey(b) || byAge(a, b));
    // Dans chaque groupe, l'enfant marié dans une autre lignée va au bord (droite d'abord, puis gauche).
    const groups: string[][] = [];
    for (const c of kids) {
      const last = groups[groups.length - 1];
      if (last && groupKey(last[0]) === groupKey(c)) last.push(c);
      else groups.push([c]);
    }
    const kidSide = new Map<string, 1 | -1>();
    for (const g of groups) {
      const inl = g.filter((c) => hasInlaw(c));
      const rest = g.filter((c) => !hasInlaw(c));
      const right = inl.filter((_, i) => i % 2 === (side === 1 ? 0 : 1));
      const left = inl.filter((_, i) => i % 2 === (side === 1 ? 1 : 0));
      left.forEach((c) => kidSide.set(c, -1));
      right.forEach((c) => kidSide.set(c, 1));
      g.splice(0, g.length, ...left, ...rest, ...right);
    }
    const ordered = groups.flat();

    const xs = new Map<string, number>();
    const contour: Contour = new Map();
    // Position de chaque enfant, rangée par couple de parents (pour centrer chaque couple sur SES enfants).
    const byGroup = new Map<number, number[]>();
    let prevKey: number | undefined;
    for (const c of ordered) {
      if (visited.has(c)) continue;
      const sub = layoutUnit(c, kidSide.get(c) ?? side);
      const key = groupKey(c);
      // Un peu plus d'air entre les enfants de deux unions différentes (demi-frères et demi-sœurs).
      const gap = prevKey !== undefined && key !== prevKey ? MIN_GAP + 44 : MIN_GAP + 12;
      prevKey = key;
      const dx = contour.size ? clearance(contour, sub.contour, 1, gap) : -sub.anchor;
      const shift = Number.isFinite(dx) ? dx : (Math.max(...[...contour.values()].map((v) => v[1])) + gap - Math.min(...[...sub.contour.values()].map((v) => v[0])));
      for (const [id, x] of sub.xs) xs.set(id, x + shift);
      mergeContour(contour, sub.contour, shift);
      byGroup.set(key, [...(byGroup.get(key) ?? []), sub.anchor + shift]);
    }
    // Le foyer se place pour que chaque couple soit au-dessus de ses propres enfants
    // (moindres carrés : la moyenne des écarts), et sinon la personne et son conjoint au centre.
    const width = (members.length - 1) * MIN_GAP;
    const pi = members.indexOf(pid);
    let start: number;
    if (byGroup.size) {
      let sum = 0;
      let n = 0;
      for (const [key, list] of byGroup) {
        const target = (Math.min(...list) + Math.max(...list)) / 2;
        const w = list.length;
        sum += (target - key * MIN_GAP) * w;
        n += w;
      }
      start = sum / n;
    } else {
      const coupleMid = members.length > 1 ? (pi + (pi === 0 ? 0.5 : -0.5)) * MIN_GAP : 0;
      start = -(members.length > 2 ? width / 2 : coupleMid);
    }
    members.forEach((m, i) => xs.set(m, start + i * MIN_GAP));
    const g0 = gen(pid);
    const row: [number, number] = [start, start + width];
    const cur = contour.get(g0);
    contour.set(g0, cur ? [Math.min(cur[0], row[0]), Math.max(cur[1], row[1])] : row);
    return { xs, contour, anchor: xs.get(pid)! };
  }

  // Racines : personnes sans parents dans l'arbre, qui ne sont pas le conjoint de quelqu'un qui en a.
  const isRoot = (id: string) => !hasParents(id) && !(spouseOf.get(id) ?? []).some((s) => hasParents(s) && gen(s) === gen(id));
  const descCount = new Map<string, number>();
  const countDesc = (id: string, seen = new Set<string>()): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    return 1 + (childrenOf.get(id) ?? []).reduce((s, c) => s + countDesc(c, seen), 0);
  };
  const roots = persons.filter((p) => isRoot(p.id)).map((p) => p.id);
  roots.forEach((r) => descCount.set(r, countDesc(r)));
  roots.sort((a, b) => descCount.get(b)! - descCount.get(a)! || gen(a) - gen(b) || byAge(a, b));
  // Tout le monde doit être placé, même sans racine (cas tordus).
  for (const p of persons) if (!roots.includes(p.id)) roots.push(p.id);

  const xs = new Map<string, number>();
  const acc: Contour = new Map();
  // Les descendants d'une racine déjà placés ailleurs (mariés dans une autre lignée) : ils disent
  // de quel côté poser cette lignée, collée à l'autre, pour que le lien reste court et ne croise personne.
  const descendants = (r: string) => {
    const out: string[] = [];
    const seen = new Set<string>();
    const q = [r, ...(spouseOf.get(r) ?? [])];
    while (q.length) {
      const x = q.shift()!;
      if (seen.has(x)) continue;
      seen.add(x);
      for (const c of childrenOf.get(x) ?? []) {
        out.push(c);
        q.push(c);
      }
    }
    return out;
  };
  const anchorsOf = (r: string) => {
    const set = new Set<string>();
    for (const d of descendants(r)) {
      if (xs.has(d)) set.add(d);
      for (const sp of spouseOf.get(d) ?? []) if (xs.has(sp) && !descendants(r).includes(sp)) set.add(sp);
    }
    return [...set];
  };
  const pending = [...roots];
  while (pending.length) {
    // La prochaine lignée : celle qui est le plus liée à ce qui est déjà posé ; sinon la plus grande.
    let pickAt = 0;
    if (acc.size) {
      let best = -1;
      pending.forEach((r, i) => {
        if (visited.has(r)) return;
        const n = anchorsOf(r).length;
        if (n > best) {
          best = n;
          pickAt = i;
        }
      });
    }
    const r = pending.splice(pickAt, 1)[0];
    if (visited.has(r)) continue;
    if (!acc.size) {
      const sub = layoutUnit(r, 1);
      for (const [id, x] of sub.xs) xs.set(id, x);
      mergeContour(acc, sub.contour, 0);
      continue;
    }
    const all = [...acc.values()];
    const placedL = Math.min(...all.map((v) => v[0]));
    const placedR = Math.max(...all.map((v) => v[1]));
    const anchors = anchorsOf(r);
    const target = anchors.length ? anchors.reduce((s, c) => s + xs.get(c)!, 0) / anchors.length : placedR;
    const sideTo: 1 | -1 = target >= (placedL + placedR) / 2 ? 1 : -1;
    // Posée à droite, ses liens vers l'autre lignée partent à gauche (et inversement).
    const sub = layoutUnit(r, anchors.length ? (sideTo === 1 ? -1 : 1) : 1);
    const gap = MIN_GAP + 40;
    const need = clearance(acc, sub.contour, sideTo, gap);
    let shift: number;
    if (!Number.isFinite(need)) {
      // Aucune rangée en commun : on la place au plus près de ses liens.
      const unitXs = [r, ...(spouseOf.get(r) ?? [])].map((m) => sub.xs.get(m)).filter((x): x is number => x !== undefined);
      const mid = (Math.min(...unitXs) + Math.max(...unitXs)) / 2;
      shift = anchors.length ? target - mid : placedR + gap - Math.min(...[...sub.contour.values()].map((v) => v[0]));
    } else {
      // Collée à la lignée liée ; pour un conjoint venu d'ailleurs, ses parents au-dessus de lui si possible.
      const ghosts = [r, ...(spouseOf.get(r) ?? [])].flatMap((m) => childrenOf.get(m) ?? []).filter((c) => xs.has(c));
      if (ghosts.length) {
        const gx = ghosts.reduce((s, c) => s + xs.get(c)!, 0) / ghosts.length;
        const unitXs = [r, ...(spouseOf.get(r) ?? [])].map((m) => sub.xs.get(m)).filter((x): x is number => x !== undefined);
        const want = gx - (Math.min(...unitXs) + Math.max(...unitXs)) / 2;
        shift = sideTo === 1 ? Math.max(want, need) : Math.min(want, need);
      } else shift = need;
    }
    for (const [id, x] of sub.xs) xs.set(id, x + shift);
    mergeContour(acc, sub.contour, shift);
  }

  // Mise en page finale : marge à gauche pour les numéros de génération, arbre centré s'il est étroit.
  const minX = Math.min(...xs.values(), 0);
  const maxX = Math.max(...xs.values(), 0);
  const width = Math.max(minWidth, Math.round(maxX - minX) + EDGE * 2);
  const offset = (width - (maxX - minX)) / 2 - minX;

  const pos = new Map<string, NodePos>();
  for (const p of persons) {
    const g = gen(p.id);
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
      x: Math.round((xs.get(p.id) ?? 0) + offset),
      y: TOP + (g - 1) * ROW_GAP,
      r: RADIUS[g - 1] ?? 16,
    });
  }

  const links: Link[] = [];
  for (const u of unions) {
    const a = pos.get(u.partnerA);
    const b = pos.get(u.partnerB);
    if (!a || !b) continue;
    const [l, r] = a.x < b.x ? [a, b] : [b, a];
    // Quelqu'un entre les deux conjoints (plusieurs unions) : le lien passe au-dessus, en arc, sans le traverser.
    const between = a.y === b.y && [...pos.values()].some((n) => n.y === l.y && n.x > l.x && n.x < r.x);
    const d =
      a.y !== b.y
        ? `M${l.x} ${l.y} L${r.x} ${r.y}`
        : between
          ? `M${l.x} ${l.y - l.r} Q${(l.x + r.x) / 2} ${l.y - l.r - Math.min(46, 16 + (r.x - l.x) / 6)} ${r.x} ${r.y - r.r}`
          : `M${l.x + l.r} ${l.y} H${r.x - r.r}`;
    const arcTop = l.y - l.r - Math.min(46, 16 + (r.x - l.x) / 6) / 2 - 4;
    links.push({ id: u.id, d, kind: "union", rank: u.rank, separated: !!u.separated, sepYear: u.separatedYear, label: { x: (l.x + r.x) / 2, y: between ? arcTop : l.y - 8 }, delay: 0.3 });
  }
  // ── Liens parents → enfants ─────────────────────────────────────────
  // Chaque couple a sa barre horizontale. Sur une même rangée, les barres qui se recouvrent
  // sont posées à des hauteurs différentes, choisies pour croiser le moins possible les traits
  // des autres familles (jamais deux barres l'une sur l'autre).
  interface Fam { key: string; sx: number; sy: number; top: number; kids: { pa: Parentage; x: number; y: number }[]; l: number; r: number; level: number }
  const fams = new Map<string, Fam>();
  for (const pa of parentages) {
    const child = pos.get(pa.childId);
    const parents = pa.parentIds.map((id) => pos.get(id)).filter(Boolean) as NodePos[];
    if (!child || !parents.length) continue;
    let sx = parents.reduce((s, p) => s + p.x, 0) / parents.length;
    let sy = parents.length > 1 && parents[0].y === parents[1].y ? parents[0].y : parents[0].y + parents[0].r;
    // Parents séparés par une autre personne (plusieurs unions) : le lien part du parent qui n'a
    // que cette union (2e épouse, ex-conjoint), pour ne jamais sembler partir de la personne du milieu.
    if (parents.length === 2 && parents[0].y === parents[1].y) {
      const [l, r] = parents[0].x < parents[1].x ? [parents[0], parents[1]] : [parents[1], parents[0]];
      if ([...pos.values()].some((n) => n.y === l.y && n.x > l.x && n.x < r.x)) {
        const nU = (id: string) => unions.filter((u) => u.partnerA === id || u.partnerB === id).length;
        const own = nU(l.id) <= nU(r.id) ? l : r;
        sx = own.x;
        sy = own.y + own.r;
      }
    }
    const key = `${[...pa.parentIds].sort().join("-")}`;
    const f = fams.get(key) ?? { key, sx, sy, top: Math.max(...parents.map((p) => p.y)), kids: [], l: sx, r: sx, level: 0 };
    f.kids.push({ pa, x: child.x, y: child.y - child.r });
    f.l = Math.min(f.l, child.x);
    f.r = Math.max(f.r, child.x);
    fams.set(key, f);
  }
  // Rangée par rangée (selon la génération des parents).
  const byTop = new Map<number, Fam[]>();
  for (const f of fams.values()) byTop.set(f.top, [...(byTop.get(f.top) ?? []), f]);
  const barY = new Map<string, number>();
  for (const [top, list] of byTop) {
    const childTop = Math.min(...list.flatMap((f) => f.kids.map((k) => k.y)));
    const lo = top + 50; // sous les noms des parents
    const hi = childTop - 16; // au-dessus des portraits des enfants
    const LEVELS = Math.max(1, Math.floor((hi - lo) / 12) + 1);
    const yOf = (lv: number, n: number) => (n <= 1 ? (lo + hi) / 2 : lo + ((hi - lo) * lv) / (n - 1));
    // Les familles les plus étroites d'abord : elles ont le plus de chances de rester sur la ligne du milieu.
    const order = [...list].sort((a, b) => a.r - a.l - (b.r - b.l) || a.l - b.l);
    const placed: Fam[] = [];
    const used = Math.min(LEVELS, Math.max(1, list.length));
    const n = Math.min(LEVELS, 2 * used + 1);
    const mid = Math.floor((n - 1) / 2);
    for (const f of order) {
      let best = mid;
      let bestCost = Infinity;
      for (let lv = 0; lv < n; lv++) {
        const y = yOf(lv, n);
        let cost = Math.abs(lv - mid) * 0.01;
        for (const g of placed) {
          const gy = yOf(g.level, n);
          // Deux barres sur la même ligne qui se recouvrent : interdit.
          if (Math.abs(gy - y) < 6 && Math.min(f.r, g.r) - Math.max(f.l, g.l) > -14) cost += 1000;
          // Mon trait de descente traverse la barre de l'autre (ou l'inverse).
          if (f.sx > g.l && f.sx < g.r && gy < y) cost += 1;
          if (g.sx > f.l && g.sx < f.r && y < gy) cost += 1;
          // Les traits vers mes enfants traversent la barre de l'autre (ou l'inverse).
          for (const k of f.kids) if (k.x > g.l && k.x < g.r && gy > y) cost += 1;
          for (const k of g.kids) if (k.x > f.l && k.x < f.r && y > gy) cost += 1;
        }
        if (cost < bestCost) {
          bestCost = cost;
          best = lv;
        }
      }
      f.level = best;
      placed.push(f);
      barY.set(f.key, Math.round(yOf(best, n)));
    }
  }
  for (const f of fams.values()) {
    const midY = barY.get(f.key)!;
    for (const k of f.kids)
      links.push({ id: `${k.pa.parentIds.join("-")}>${k.pa.childId}`, d: `M${f.sx} ${f.sy} V${midY} H${k.x} V${k.y}`, kind: k.pa.kind === "biological" ? "child" : "fostered", delay: 0.4 + (pos.get(k.pa.childId)!.generation) * 0.35 });
  }

  const rowsY = [...new Set([...pos.values()].map((p) => p.y))].sort((a, b) => a - b);
  const height = (rowsY[rowsY.length - 1] ?? TOP) + 70;
  return { nodes: [...pos.values()], links, width, height, rowsY };
}
