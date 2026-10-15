import "server-only";
import { redirect } from "next/navigation";
import { getT } from "../i18n/server";
import { getViewer } from "./auth";
import { read } from "./store";

/** Pour les pages réservées à la famille : redirige vers la création ou l'accueil des invités. */
export async function requireMember() {
  const s = read();
  if (!s.family) redirect("/creer");
  const viewer = await getViewer();
  if (!viewer.user) redirect("/bienvenue");
  const { t, lang } = await getT();
  return { s, family: s.family!, viewer, t, lang };
}

export async function requireEditor() {
  const ctx = await requireMember();
  if (!ctx.viewer.canEdit) redirect("/accueil");
  return ctx;
}

export async function requireAdmin() {
  const ctx = await requireMember();
  if (!ctx.viewer.isAdmin) redirect("/accueil");
  return ctx;
}
