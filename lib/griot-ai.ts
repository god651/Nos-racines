import { cloudAvailable, supa } from "@/lib/cloud";
import { getLink } from "@/lib/local/sync";
import { kv, read } from "@/lib/local/store-core";
import { fullName, type Store } from "@/lib/types";

// Le Griot « questions libres » : il demande à un modèle de langue, sur le serveur de la famille,
// en lui donnant tout ce que l'arbre contient (fiches, liens, récits, souvenirs). Il faut Internet.

const yrs = (b?: number, d?: number, living?: boolean) => (b ? (d ? `${b}-${d}` : living ? `né(e) en ${b}` : `${b}-?`) : d ? `décès ${d}` : "");

/** Toute la famille en texte compact (ce que le Griot sait, et rien d'autre). */
export function familyContext(s: Store = read(), meId?: string) {
  const L: string[] = [];
  const f = s.family;
  if (f) L.push(`Famille : ${f.name}${f.village ? ` · village d'origine : ${f.village}` : ""}${f.motto ? ` · devise : « ${f.motto} »` : ""}${f.since ? ` · depuis ${f.since}` : ""}`);
  const name = new Map(s.persons.map((p) => [p.id, fullName(p)]));
  const me = meId ? s.persons.find((p) => p.id === meId) : undefined;
  if (me) L.push(`La personne qui pose la question est : ${fullName(me)}.`);
  L.push("", "PERSONNES (nom | sexe | dates | infos) :");
  for (const p of s.persons) {
    if (p.placeholder) continue;
    const info = [
      p.nickname && `surnom ${p.nickname}`,
      p.dayName && `nom traditionnel ${p.dayName}${p.dayNameMeaning ? ` (${p.dayNameMeaning})` : ""}`,
      p.isLiving ? "en vie" : "défunt(e)",
      p.birthDate && `naissance ${p.birthDate}`,
      p.deathDate && `décès ${p.deathDate}`,
      p.village && `village ${p.village}`,
      p.city && `vit à ${p.city}`,
      p.job && `métier ${p.job}`,
      p.ethnicity && `peuple ${p.ethnicity}`,
      p.clan && `clan ${p.clan}`,
      p.favoriteDishes?.length && `plats favoris ${p.favoriteDishes.join(", ")}`,
      p.quote && `citation « ${p.quote} »`,
      p.bio && `histoire : ${p.bio.slice(0, 1500)}`,
      p.timeline?.length && `étapes : ${p.timeline.map((e) => `${e.year} ${e.text}`).join(" ; ")}`,
    ].filter(Boolean);
    L.push(`- ${fullName(p)} | ${p.sex === "f" ? "femme" : "homme"} | ${yrs(p.birthYear, p.deathYear, p.isLiving)} | ${info.join(" · ")}`);
  }
  L.push("", "PARENTS (enfant <- parents) :");
  for (const pa of s.parentages) {
    const c = name.get(pa.childId);
    if (c) L.push(`- ${c} <- ${pa.parentIds.map((x) => name.get(x) ?? "?").join(" et ")}${pa.kind !== "biological" ? ` (${pa.kind})` : ""}`);
  }
  L.push("", "UNIONS :");
  for (const u of s.unions) {
    const a = name.get(u.partnerA), b = name.get(u.partnerB);
    if (a && b) L.push(`- ${a} & ${b}${u.rank ? ` (${u.rank}e union)` : ""}${u.separated ? ` (séparés${u.separatedYear ? ` en ${u.separatedYear}` : ""})` : ""}`);
  }
  if (s.stories.length) {
    L.push("", "RÉCITS ENREGISTRÉS :");
    for (const st of s.stories) L.push(`- « ${st.title} », raconté par ${name.get(st.personId) ?? "?"}${st.text ? ` : ${st.text.slice(0, 2500)}` : " (voix seulement, pas de texte)"}`);
  }
  if (s.memories.length) {
    L.push("", "SOUVENIRS (photos) :");
    for (const m of s.memories) L.push(`- ${m.year ? `${m.year} : ` : ""}${m.caption}${m.personIds.length ? ` (avec ${m.personIds.map((x) => name.get(x) ?? "?").join(", ")})` : ""}`);
  }
  return L.join("\n");
}

export const griotOnlineAvailable = () => cloudAvailable && !!getLink();

export async function askGriotOnline(question: string, history: { me: boolean; text: string }[], meId?: string): Promise<{ answer: string; left?: number }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("hors_ligne");
  const link = getLink();
  if (!link) throw new Error("non_configure");
  const s = read();
  const { data, error } = await supa().functions.invoke("griot", {
    body: { fid: link.fid, question, context: familyContext(s, meId), lang: kv.get("nr_langue") ?? s.settings.language ?? "fr", familyName: s.family?.name ?? "", history },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let code = "reseau";
    try {
      if (ctx && typeof ctx.json === "function") code = ((await ctx.json()) as { error?: string }).error ?? code;
    } catch {}
    throw new Error(code);
  }
  return data as { answer: string; left?: number };
}
