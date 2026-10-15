import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import nuage from "@/nuage.json";

// ═══════════════════════════════════════════════════════════════════
// La base centrale (Supabase) : comptes personnels (e-mail et mot de passe),
// la famille unique, le temps réel, les photos et les voix.
// Sans adresse configurée (nuage.json vide), l'application reste 100 % dans le téléphone.
// ═══════════════════════════════════════════════════════════════════

const URL_ = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) || nuage.url || "").replace(/\/$/, "");
const KEY_ = (import.meta.env.VITE_SUPABASE_KEY as string | undefined) || nuage.key || "";
export const cloudAvailable = !!(URL_ && KEY_);
export const CLOUD_URL = URL_;

let sb: SupabaseClient | null = null;
export function supa(): SupabaseClient {
  if (!cloudAvailable) throw new Error("La base en ligne n’est pas encore configurée dans cette version.");
  if (!sb) {
    sb = createClient(URL_, KEY_, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "nr-compte" },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return sb;
}

// ─── Session (compte connecté) ───
let session: Session | null = null;
let ready = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const getSession = () => session;
export const sessionReady = () => ready || !cloudAvailable;
export const subscribeSession = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const myUid = () => session?.user.id ?? null;
export const myEmail = () => session?.user.email ?? null;

/** Au lancement : on retrouve le compte ouvert sur ce téléphone (il reste ouvert). */
export async function initCloud() {
  if (!cloudAvailable) {
    ready = true;
    return;
  }
  const c = supa();
  try {
    const { data } = await Promise.race([c.auth.getSession(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("lent")), 5000))]);
    session = data.session;
  } catch {
    session = null;
  }
  // Sans Internet, le jeton peut être expiré : le compte reste ouvert quand même (l'application
  // marche avec la copie du téléphone) et se reconnecte tout seul au retour du réseau.
  if (!session) {
    try {
      const raw = JSON.parse(localStorage.getItem("nr-compte") ?? "null") as Session | null;
      if (raw?.user?.id && raw.refresh_token) session = raw;
    } catch {}
  }
  ready = true;
  emit();
  c.auth.onAuthStateChange((_e, s) => {
    const changed = (s?.user.id ?? null) !== (session?.user.id ?? null);
    session = s;
    if (changed) emit();
  });
}

// ─── Messages clairs ───
const MESSAGES: [RegExp, string][] = [
  [/Invalid login credentials/i, "E-mail ou mot de passe incorrect."],
  [/Email not confirmed/i, "Confirmez d’abord votre adresse : ouvrez l’e-mail reçu et touchez le lien."],
  [/User already registered|already been registered/i, "Un compte existe déjà avec cet e-mail. Touchez « J’ai déjà un compte »."],
  [/Password should be at least|weak.?password/i, "Le mot de passe doit avoir au moins 8 caractères."],
  [/Unable to validate email|invalid.*email/i, "Cette adresse e-mail n’est pas valable."],
  [/rate limit|too many/i, "Trop d’essais. Patientez une minute puis réessayez."],
  [/NR_CONNEXION/, "Connectez-vous d’abord à votre compte."],
  [/NR_ACCES_REFUSE/, "Votre rôle dans la famille ne permet pas cette action."],
  [/NR_INVITATION/, "Ce code d’invitation n’est plus valable. Demandez-en un nouveau à un administrateur."],
  [/NR_FAMILLE_INCONNUE/, "Aucune famille avec cet identifiant. Vérifiez chaque caractère."],
  [/NR_TROIS_ADMINS/, "La famille a déjà 3 administrateurs (le maximum)."],
  [/NR_FONDATEUR_FAMILLE/, "L’administrateur principal de la famille garde toujours son rôle."],
  [/NR_DEJA_PRIS/, "Cette personne de l’arbre est déjà reliée à un autre compte."],
  [/NR_INTROUVABLE/, "Introuvable : la fiche a peut-être été supprimée."],
  [/NR_ROLE/, "Rôle inconnu."],
  [/Failed to fetch|NetworkError|Load failed|fetch/i, "Pas de connexion pour le moment. Réessayez plus tard."],
];
export function frenchError(e: unknown): Error {
  const m = (e as { message?: string })?.message ?? String(e);
  for (const [re, fr] of MESSAGES) if (re.test(m)) return new Error(fr);
  return new Error(m || "Une erreur est survenue.");
}

/** Appel d'une fonction du serveur (elles vérifient toutes le compte et son rôle). */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supa().rpc(fn, args);
  if (error) throw frenchError(error);
  return data as T;
}

// ─── Comptes ───
export async function signUp(email: string, password: string, name: string): Promise<"ok" | "confirmer"> {
  const emailRedirectTo = (import.meta.env.VITE_VIEW_URL as string | undefined) || undefined;
  const { data, error } = await supa().auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() }, emailRedirectTo } });
  if (error) throw frenchError(error);
  if (!data.session) return "confirmer";
  session = data.session;
  await rpc("nr_set_profile", { name: name.trim() });
  emit();
  return "ok";
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supa().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw frenchError(error);
  session = data.session;
  const pending = (data.user.user_metadata as { name?: string } | undefined)?.name;
  const me = await rpc<{ user: { display_name: string } }>("nr_me");
  if (!me.user.display_name && pending) await rpc("nr_set_profile", { name: pending });
  emit();
}

export async function signOut() {
  try {
    await supa().auth.signOut();
  } catch {}
  session = null;
  emit();
}

/** Mot de passe oublié : un e-mail avec un lien pour en choisir un nouveau. */
export async function resetPassword(email: string) {
  const redirectTo = (import.meta.env.VITE_VIEW_URL as string | undefined) || undefined;
  const { error } = await supa().auth.resetPasswordForEmail(email.trim(), redirectTo ? { redirectTo } : undefined);
  if (error) throw frenchError(error);
}

export async function changePassword(password: string) {
  const { error } = await supa().auth.updateUser({ password });
  if (error) throw frenchError(error);
}

// ─── Fichiers (photos, voix, vidéos) ───
export async function uploadMedia(path: string, blob: Blob, bucket: "medias" | "portraits" = "medias") {
  const { error } = await supa().storage.from(bucket).upload(path, blob, { upsert: true, contentType: blob.type || "application/octet-stream" });
  if (error && !/already exists|Duplicate/i.test(error.message)) throw frenchError(error);
}
export async function downloadMedia(path: string): Promise<Blob | null> {
  const { data, error } = await supa().storage.from("medias").download(path);
  return error ? null : data;
}
export const publicPortraitUrl = (fid: string, mid: string) => `${URL_}/storage/v1/object/public/portraits/${encodeURIComponent(fid)}/${encodeURIComponent(mid)}`;
