import { ownerIdOf, type Store, type Viewer } from "../types";
import { kv, read } from "@/lib/local/store-core";
import { NextResponse } from "next/server";

// Chaque appareil garde son jeton de session. Pas de mot de passe.

export const SESSION_COOKIE = "nr_session";
export const LANG_COOKIE = "nr_langue";

export async function getViewer(): Promise<Viewer> {
  return viewerFromToken(read(), kv.get(SESSION_COOKIE));
}

export function viewerFromToken(s: Store, token?: string): Viewer {
  const sess = token ? s.sessions.find((x) => x.token === token) : undefined;
  const user = sess ? s.users.find((u) => u.id === sess.userId) ?? null : null;
  const isOwner = !!user && ownerIdOf(s) === user.id;
  return { user, role: isOwner ? "admin" : user?.role ?? null, isAdmin: isOwner || user?.role === "admin", isOwner, isCreator: !!user?.creator && creatorDevice() };
}

export function sessionCookie(token: string) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 * 5 };
}

/** Adresse de base des QR codes : l'adresse de l'application, suivie du « # » de navigation. */
export async function baseUrl() {
  return `${location.origin}${location.pathname}#`;
}

export const deny = (message: string, status = 403) => NextResponse.json({ error: message }, { status });

/** Le titre de Fondateur ne s'ouvre que sur un téléphone où le code créateur a été tapé
 *  (une sauvegarde restaurée ailleurs ne le transmet jamais). */
function creatorDevice() {
  try {
    return kv.get("nr_createur") === "1";
  } catch {
    return false;
  }
}
