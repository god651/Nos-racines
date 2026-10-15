import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Viewer } from "../types";
import { SESSION_COOKIE, viewerFromToken } from "./auth";
import { read } from "./store";

export const ok = (data: unknown = { ok: true }, init?: ResponseInit) => NextResponse.json(data, init);
export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export function viewerOf(req: NextRequest): Viewer {
  return viewerFromToken(read(), req.cookies.get(SESSION_COOKIE)?.value);
}

/** Garde : seuls les administrateurs modifient la famille. */
export function needAdmin(req: NextRequest) {
  const v = viewerOf(req);
  if (!v.user) return { v, err: fail("Rejoignez d’abord la famille avec un QR code d’invitation.", 401) };
  if (!v.isAdmin) return { v, err: fail("Seul un administrateur peut modifier la famille.", 403) };
  return { v, err: null };
}

/** Garde : administrateurs et éditeurs modifient l'arbre. */
export function needEditor(req: NextRequest) {
  const v = viewerOf(req);
  if (!v.user) return { v, err: fail("Rejoignez d’abord la famille avec un QR code d’invitation.", 401) };
  if (!v.canEdit) return { v, err: fail("Seuls les administrateurs et les éditeurs peuvent modifier l’arbre.", 403) };
  return { v, err: null };
}

export function needMember(req: NextRequest) {
  const v = viewerOf(req);
  if (!v.user) return { v, err: fail("Rejoignez d’abord la famille avec un QR code d’invitation.", 401) };
  return { v, err: null };
}

export async function body<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

/** Texte propre et borné (jamais de saisie démesurée dans le fichier de la famille). */
export function txt(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, max);
  return s || undefined;
}

export function int(v: unknown, min = -5000, max = 3000): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : undefined;
}
