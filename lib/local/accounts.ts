import { kv, read } from "./store-core";

// Plusieurs comptes sur le même téléphone (par exemple le fondateur et un proche) :
// on garde les jetons et on passe de l'un à l'autre.

const KEY = "nr_comptes";

function load(): string[] {
  try {
    return JSON.parse(kv.get(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function rememberSession(token?: string) {
  if (!token) return;
  const list = load().filter((x) => x !== token);
  kv.set(KEY, JSON.stringify([token, ...list].slice(0, 8)));
}

/** Les autres comptes ouverts sur ce téléphone et encore valables. */
export function otherAccounts() {
  const s = read();
  const current = kv.get("nr_session");
  return load()
    .filter((tok) => tok !== current)
    .map((tok) => {
      const sess = s.sessions.find((x) => x.token === tok);
      const u = sess ? s.users.find((x) => x.id === sess.userId) : undefined;
      return u ? { token: tok, name: u.name, role: u.role } : null;
    })
    .filter(Boolean) as { token: string; name: string; role: string }[];
}

export function switchAccount(token: string) {
  rememberSession(kv.get("nr_session"));
  kv.set("nr_session", token);
}
