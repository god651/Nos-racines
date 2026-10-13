// Navigation de l'application téléphone : l'adresse vit après le « # » (index.html#/membre/abc).
// Ainsi l'application fonctionne partout : fichier local, application Android, page web.

export interface Route {
  path: string;
  query: URLSearchParams;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let current: Route = parse();
let version = 0;

function parseHref(raw: string): Route {
  const [path, q = ""] = raw.split("?");
  return { path: decodeURI(path) || "/", query: new URLSearchParams(q) };
}

function parse(): Route {
  let h = "";
  try {
    h = location.hash;
  } catch {}
  return parseHref(h.startsWith("#/") ? h.slice(1) : "/");
}

// Pile des écrans visités (bouton Retour), gardée dans l'application elle-même :
// fonctionne aussi dans une page intégrée où l'historique du navigateur est limité.
const stack: string[] = [];

if (typeof window !== "undefined") {
  // Tous les liens internes (« /membre/… ») passent par la navigation de l'application.
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    const a = (e.target as HTMLElement | null)?.closest("a");
    const href = a?.getAttribute("href");
    if (!a || !href || !href.startsWith("/") || a.hasAttribute("download") || a.target === "_blank") return;
    e.preventDefault();
    navigate(href);
  });
}

function hrefOf(r: Route) {
  const q = r.query.toString();
  return r.path + (q ? "?" + q : "");
}

export function navigate(href: string, replace = false) {
  if (!replace) stack.push(hrefOf(current));
  current = parseHref(href);
  try {
    history.replaceState(null, "", "#" + href);
  } catch {}
  version++;
  listeners.forEach((l) => l());
  try {
    window.scrollTo(0, 0);
  } catch {}
}

export function back() {
  const prev = stack.pop();
  navigate(prev && prev !== "/" ? prev : "/accueil", true);
}

export const getRoute = () => current;
export const getRouteVersion = () => version;
export function subscribeRoute(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Associe une adresse à un motif « /membre/:id ». */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/").filter(Boolean);
  const b = path.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
