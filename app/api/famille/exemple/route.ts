import type { NextRequest } from "next/server";
import { body, fail, ok, txt } from "@/lib/server/api";
import { sessionCookie } from "@/lib/server/auth";
import { mutate, newId, read, shortCode } from "@/lib/server/store";
import type { Person } from "@/lib/types";

// Famille d'exemple (fictive) pour découvrir l'application avant d'entrer la sienne.
// Elle se supprime ensuite depuis les paramètres (« Réinitialiser »).

export async function POST(req: NextRequest) {
  if (read().family) return fail("Une famille existe déjà sur ce téléphone.", 409);
  const b = await body(req);
  const userName = txt(b.userName, 60) ?? "Kouadio";
  const token = newId(32);
  await mutate((s) => {
    const now = Date.now();
    const codes = new Set<string>();
    const P = (x: Partial<Person> & Pick<Person, "givenName" | "sex">): Person => {
      const qrCode = shortCode(4, codes);
      codes.add(qrCode);
      return { id: newId(), familyName: "Kouassi", isLiving: true, qrCode, visibility: "famille", timeline: [], createdAt: now, ...x };
    };
    const nk = P({
      givenName: "N’Guessan", sex: "m", birthYear: 1921, deathYear: 1998, isLiving: false, village: "Sakassou", job: "Planteur de café",
      ethnicity: "Baoulé", clan: "Faafoué", dayName: "Kouassi", dayNameMeaning: "né un dimanche", visibility: "public",
      quote: "La terre que tu plantes nourrit tes petits-enfants.",
      bio: "Aîné de sept enfants, il quitte l’école à douze ans pour aider aux champs. En 1946, il plante ses premiers caféiers à la sortie de Sakassou.",
      timeline: [
        { year: 1921, text: "Naissance à Sakassou" },
        { year: 1944, text: "Mariage coutumier avec Akissi" },
        { year: 1946, text: "Premiers caféiers plantés" },
        { year: 1952, text: "Mariage avec Ahou" },
        { year: 1998, text: "Il repose au village" },
      ],
    });
    const ak = P({ givenName: "Akissi", sex: "f", birthYear: 1926, deathYear: 2009, isLiving: false, village: "Sakassou", job: "Commerçante de pagnes" });
    const ah = P({ givenName: "Ahou", sex: "f", birthYear: 1931, deathYear: 2015, isLiving: false, village: "Sakassou", job: "Cuisinière" });
    const yk = P({ givenName: "Yao", sex: "m", birthYear: 1947, nickname: "Papa Yao", city: "Bouaké", job: "Instituteur" });
    const ad = P({ givenName: "Adjoua", sex: "f", birthYear: 1950, city: "Bouaké", job: "Sage-femme" });
    const ko = P({ givenName: "Konan", sex: "m", birthYear: 1955, city: "Yamoussoukro", job: "Mécanicien" });
    const am = P({ givenName: "Amenan", sex: "f", birthYear: 1953, village: "Toumodi", city: "Bouaké", job: "Couturière" });
    const kd = P({ givenName: userName, sex: "m", birthYear: 1984, city: "Cocody, Abidjan" });
    const ay = P({ givenName: "Aya", sex: "f", birthYear: 1988, city: "Paris", job: "Infirmière" });
    const af = P({ givenName: "Affoué", sex: "f", birthYear: 1986, city: "San-Pédro", job: "Comptable" });
    s.persons.push(nk, ak, ah, yk, am, ad, ko, kd, ay, af);
    s.unions.push({ id: newId(), partnerA: nk.id, partnerB: ak.id, kind: "customary", rank: 1 }, { id: newId(), partnerA: nk.id, partnerB: ah.id, kind: "customary", rank: 2 }, { id: newId(), partnerA: yk.id, partnerB: am.id, kind: "civil" });
    s.parentages.push(
      { childId: yk.id, parentIds: [nk.id, ak.id], kind: "biological" },
      { childId: ad.id, parentIds: [nk.id, ak.id], kind: "fostered" },
      { childId: ko.id, parentIds: [nk.id, ah.id], kind: "biological" },
      { childId: kd.id, parentIds: [yk.id, am.id], kind: "biological" },
      { childId: ay.id, parentIds: [yk.id, am.id], kind: "biological" },
      { childId: af.id, parentIds: [ko.id], kind: "biological" },
    );
    s.family = { id: newId(), name: "Famille Kouassi (exemple)", village: "Sakassou", since: 1921, motto: "Ce que nous sommes, ils le sauront", treeCode: shortCode(6), covers: [], createdAt: now };
    const user = { id: newId(), name: userName, role: "admin" as const, personId: kd.id, createdAt: now };
    s.users.push(user);
    s.family!.ownerId = user.id;
    s.sessions.push({ token, userId: user.id, createdAt: now });
    // Dates proches d'aujourd'hui, pour voir les anniversaires dans la démo.
    const md = (offset: number) => {
      const d = new Date(Date.now() + offset * 86400000);
      return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    nk.favoriteDishes = ["Foutou igname", "Sauce graine", "Vin de palme"];
    ak.favoriteDishes = ["Kédjénou de poulet", "Attiéké"];
    yk.favoriteDishes = ["Garba", "Alloco"];
    ad.favoriteDishes = ["Placali sauce kplala"];
    nk.deathDate = `1998-${md(2)}`;
    nk.birthDate = `1921-${md(140)}`;
    ak.deathDate = `2009-${md(0)}`;
    yk.birthDate = `1947-${md(0)}`;
    ad.birthDate = `1950-${md(9)}`;
    ah.deathDate = `2015-${md(60)}`;
    // Hommages au mémorial.
    const trib = (personId: string, kind: "candle" | "message", byName: string, text: string | undefined, ago: number) =>
      s.tributes.push({ id: newId(), personId, kind, text, byName, by: user.id, createdAt: now - ago });
    for (let i = 0; i < 5; i++) trib(nk.id, "candle", "Famille", undefined, 86400000 * (i + 2));
    trib(nk.id, "message", "Yao", "Papa, chaque saison des pluies je pense à tes caféiers. Nous les avons replantés derrière la case. Repose en paix.", 86400000 * 30);
    trib(nk.id, "message", "Adjoua", "Merci de m’avoir accueillie comme ta fille. Tes conseils m’accompagnent chaque jour à la maternité.", 86400000 * 12);
    trib(ak.id, "candle", "Famille", undefined, 86400000 * 3);
    trib(ak.id, "message", "Konan", "Maman Akissi, tes pagnes colorent encore nos fêtes.", 86400000 * 40);
    // Quelques récits écrits, pour découvrir la lecture des histoires.
    const story = (personId: string, title: string, text: string, ago: number) =>
      s.stories.push({ id: newId(), personId, title, text, durationSec: 0, language: "fr", createdAt: now - ago, by: user.id });
    story(nk.id, "Les premiers caféiers", "Papa racontait qu’il avait porté les jeunes plants sur sa tête depuis Béoumi, deux jours de marche. Il les a mis en terre à la saison des pluies de 1946, derrière la case de sa mère. « Un caféier, c’est un enfant : il faut cinq ans avant qu’il te rende ce que tu lui donnes. »", 5e6);
    story(yk.id, "L’école sous le manguier", "Ma première classe, à Sakassou, c’était un manguier et une ardoise pour trois. Le maître venait de Bouaké à vélo. Quand il pleuvait, on rentrait tous dans le grenier du chef. C’est là que j’ai décidé d’être instituteur.", 4e6);
    story(ad.id, "Confiée à Tantie Akissi", "J’avais six ans quand ma mère m’a confiée à Akissi, sa cousine, pour que j’aille à l’école en ville. Akissi m’a élevée comme sa propre fille. Dans notre famille, on ne dit pas « tante » : on dit « maman ».", 3e6);
  });
  const res = ok();
  res.cookies.set(sessionCookie(token));
  return res;
}
