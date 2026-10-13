import type { NextRequest } from "next/server";
import { childrenOf, familyStats, parentsOf, siblingsOf, spousesOf } from "@/lib/genealogy";
import { isLang, makeT, type T } from "@/lib/i18n/core";
import { dictFor } from "@/lib/i18n/server";
import { LANG_COOKIE } from "@/lib/server/auth";
import { body, fail, needMember, ok } from "@/lib/server/api";
import { read } from "@/lib/server/store";
import { fullName, type Person, type Store } from "@/lib/types";

// Le Griot de la famille : il répond UNIQUEMENT à partir des fiches enregistrées et cite ses sources.
// Il raisonne sur l'arbre sur l'ordinateur de la famille : rien n'est envoyé sur Internet.

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function findPerson(s: Store, q: string) {
  const t = norm(q);
  return [...s.persons]
    .sort((a, b) => b.givenName.length - a.givenName.length)
    .find((p) => t.includes(norm(p.givenName)) || (p.nickname && t.includes(norm(p.nickname))));
}

function card(t: T, p: Person) {
  const years = p.birthYear ? (p.deathYear ? `${p.birthYear} – ${p.deathYear}` : t("né(e) en {y}", { y: p.birthYear })) : "";
  return { id: p.id, name: fullName(p), photoId: p.photoId, sub: [years, p.job, p.city ?? p.village].filter(Boolean).join(" · ") };
}

function answer(s: Store, q: string, t: T, me?: string) {
  const n = norm(q);
  if (!s.persons.length) return { answer: t("L’arbre est encore vide. Ajoutez une première personne et je pourrai vous répondre."), source: t("Arbre familial") };

  if (n.includes("generation")) {
    const st = familyStats(s);
    return { answer: t("L’arbre compte {g} génération(s) et {m} personne(s).", { g: st.generations, m: st.members }), source: t("Arbre familial") };
  }
  if ((n.includes("combien") || n.includes("how many")) && (n.includes("membre") || n.includes("personne") || n.includes("member") || n.includes("people"))) {
    return { answer: t("L’arbre compte {m} personne(s), dont {v} en vie.", { m: s.persons.length, v: s.persons.filter((p) => p.isLiving).length }), source: t("Arbre familial") };
  }
  const place = /(?:originaires? de|nes? a|vivent a|habite(?:nt)? a|come from|from|live in|de) ([a-z' -]+?)\s*\??$/.exec(n)?.[1]?.trim();
  if (place && (n.includes("originaire") || n.includes("vivent") || n.includes("habite") || n.includes("ne a") || n.includes("nes a") || n.includes("from") || n.includes("live in"))) {
    const found = s.persons.filter((p) => [p.village, p.city].some((v) => v && norm(v) === place));
    if (!found.length) return { answer: t("Aucune fiche ne mentionne {lieu} pour le moment.", { lieu: place }), source: t("Fiches de la famille") };
    return { answer: t("{n} personne(s) : {noms}.", { n: found.length, noms: found.map(fullName).join(", ") }), card: found.length === 1 ? card(t, found[0]) : undefined, source: t("Fiches de la famille") };
  }
  if (n.includes("doyen") || n.includes("plus age") || n.includes("plus ancien") || n.includes("oldest") || n.includes("eldest")) {
    const living = s.persons.filter((p) => p.isLiving && p.birthYear).sort((a, b) => a.birthYear! - b.birthYear!);
    const pool = n.includes("doyenne") || n.includes("woman") ? living.filter((p) => p.sex === "f") : living;
    const d = pool[0];
    if (!d) return { answer: t("Aucune date de naissance n’est encore indiquée pour les personnes en vie."), source: t("Fiches de la famille") };
    return { answer: t("La personne la plus âgée en vie est {nom}, née en {y}.", { nom: fullName(d), y: d.birthYear! }), card: card(t, d), source: t("Fiches de la famille") };
  }

  // Questions sur une personne nommée, ou sur « mon père », « mon grand-père »…
  let target: Person | undefined = findPerson(s, q);
  if (!target && (n.includes("mon") || n.includes("ma ") || n.includes("my ")) && me) {
    const depth = n.includes("arriere-grand") || n.includes("great-grand") ? 3 : n.includes("grand") ? 2 : n.match(/\b(pere|mere|parent|father|mother)/) ? 1 : 0;
    let cur = [s.persons.find((p) => p.id === me)!].filter(Boolean);
    for (let i = 0; i < depth; i++) cur = cur.flatMap((p) => parentsOf(s, p.id));
    const wantsF = (n.includes("mere") && !n.includes("pere")) || (n.includes("mother") && !n.includes("father"));
    target = cur.find((p) => (wantsF ? p.sex === "f" : p.sex === "m")) ?? cur[0];
  }
  if (!target && (n.includes("aime") || n.includes("likes") || n.includes("plat"))) {
    const fans = s.persons.filter((p) => (p.favoriteDishes ?? []).some((d) => norm(d).split(/\s+/).some((w) => w.length > 3 && n.includes(w))));
    if (fans.length) return { answer: t("{n} personne(s) : {noms}.", { n: fans.length, noms: fans.map(fullName).join(", ") }), card: fans.length === 1 ? card(t, fans[0]) : undefined, source: t("Fiches de la famille") };
  }
  if (!target) {
    return { answer: t("Je réponds à partir de vos fiches. Essayez : « Combien de générations avons-nous ? » ou « Qui sont les enfants de … ? »"), source: t("Le Griot de la famille") };
  }
  if (n.includes("plat") || n.includes("manger") || n.includes("mange") || n.includes("cuisine") || n.includes("dish") || n.includes("food")) {
    const d = target.favoriteDishes ?? [];
    return d.length
      ? { answer: t("Plats favoris de {nom} : {liste}.", { nom: fullName(target), liste: d.join(", ") }), card: card(t, target), source: t("Fiche de {nom}", { nom: target.givenName }) }
      : { answer: t("Les plats favoris de {nom} ne sont pas encore indiqués.", { nom: fullName(target) }), card: card(t, target), source: t("Fiche de {nom}", { nom: target.givenName }) };
  }
  if (n.includes("frere") || n.includes("soeur") || n.includes("brother") || n.includes("sister") || n.includes("sibling")) {
    const f = n.includes("soeur") || n.includes("sister"), m = n.includes("frere") || n.includes("brother");
    const sib = siblingsOf(s, target.id).filter((p) => (f && !m ? p.sex === "f" : m && !f ? p.sex === "m" : true));
    return sib.length
      ? { answer: t("Frères et sœurs de {nom} : {liste}.", { nom: fullName(target), liste: sib.map(fullName).join(", ") }), card: card(t, sib[0]), source: t("Arbre familial") }
      : { answer: t("Aucun frère ni aucune sœur de {nom} n’est encore dans l’arbre.", { nom: fullName(target) }), card: card(t, target), source: t("Arbre familial") };
  }
  if (n.includes("enfant") || n.includes("fils") || n.includes("fille") || n.includes("child") || /\bsons?\b/.test(n) || n.includes("daughter")) {
    const ch = childrenOf(s, target.id);
    return ch.length
      ? { answer: t("Enfants de {nom} : {liste}.", { nom: fullName(target), liste: ch.map(fullName).join(", ") }), source: t("Arbre familial") }
      : { answer: t("Aucun enfant de {nom} n’est encore dans l’arbre.", { nom: fullName(target) }), source: t("Arbre familial") };
  }
  if (n.includes("parent") || n.includes("pere") || n.includes("mere") || n.includes("father") || n.includes("mother")) {
    const ps = parentsOf(s, target.id);
    return ps.length
      ? { answer: t("Parents de {nom} : {liste}.", { nom: fullName(target), liste: ps.map(fullName).join(", ") }), card: card(t, ps[0]), source: t("Arbre familial") }
      : { answer: t("Les parents de {nom} ne sont pas encore dans l’arbre.", { nom: fullName(target) }), source: t("Arbre familial") };
  }
  if (n.includes("epou") || n.includes("mari") || n.includes("femme") || n.includes("conjoint") || n.includes("wife") || n.includes("husband") || n.includes("spouse")) {
    const sp = spousesOf(s, target.id);
    return sp.length
      ? { answer: t("Conjoint(s) de {nom} : {liste}.", { nom: fullName(target), liste: sp.map((x) => fullName(x.person)).join(", ") }), card: card(t, sp[0].person), source: t("Arbre familial") }
      : { answer: t("Aucun conjoint de {nom} n’est encore indiqué.", { nom: fullName(target) }), source: t("Arbre familial") };
  }
  const stories = s.stories.filter((x) => x.personId === target!.id).length;
  return {
    answer: [target.bio, stories ? t("{n} récit(s) enregistré(s).", { n: stories }) : ""].filter(Boolean).join(" ") || t("Voici la fiche de {nom}.", { nom: fullName(target) }),
    card: card(t, target),
    source: t("Fiche de {nom}", { nom: target.givenName }),
  };
}

export async function POST(req: NextRequest) {
  const { v, err } = needMember(req);
  if (err) return err;
  const { question } = await body<{ question?: string }>(req);
  if (!question || question.length > 300) return fail("Question manquante");
  const c = req.cookies.get(LANG_COOKIE)?.value;
  const t = makeT(dictFor(isLang(c) ? c : read().settings.language));
  return ok(answer(read(), question, t, v.user?.personId));
}
