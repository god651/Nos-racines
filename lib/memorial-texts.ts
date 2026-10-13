import type { Lang } from "./types";

// Prières et passages bibliques du mémorial.
// Bible : Louis Segond 1910 (français) et King James (anglais), toutes deux dans le domaine public.
// Les prières marquées « famille » sont écrites pour l'application ; {p} = prénom du défunt.

export interface Reading {
  kind: "bible" | "priere";
  ref?: string;
  fr: string;
  en: string;
  /** Variante au féminin (prières). */
  frF?: string;
  enF?: string;
}

export const READINGS: Reading[] = [
  {
    kind: "bible",
    ref: "Jean 11:25-26",
    fr: "Je suis la résurrection et la vie. Celui qui croit en moi vivra, quand même il serait mort ; et quiconque vit et croit en moi ne mourra jamais.",
    en: "I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live: and whosoever liveth and believeth in me shall never die.",
  },
  {
    kind: "priere",
    fr: "Seigneur, accueille {p} dans ta paix. Garde vivant en nous tout ce qu’il nous a donné, et console ceux qui le pleurent. Amen.",
    frF: "Seigneur, accueille {p} dans ta paix. Garde vivant en nous tout ce qu’elle nous a donné, et console ceux qui la pleurent. Amen.",
    en: "Lord, welcome {p} into your peace. Keep alive in us all that he gave us, and comfort those who mourn him. Amen.",
    enF: "Lord, welcome {p} into your peace. Keep alive in us all that she gave us, and comfort those who mourn her. Amen.",
  },
  {
    kind: "bible",
    ref: "Psaume 23:1, 4",
    fr: "L’Éternel est mon berger : je ne manquerai de rien. Quand je marche dans la vallée de l’ombre de la mort, je ne crains aucun mal, car tu es avec moi.",
    en: "The Lord is my shepherd; I shall not want. Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me.",
  },
  {
    kind: "priere",
    fr: "Donne-lui, Seigneur, le repos éternel, et que brille sur lui la lumière sans fin. Qu’il repose en paix. Amen.",
    frF: "Donne-lui, Seigneur, le repos éternel, et que brille sur elle la lumière sans fin. Qu’elle repose en paix. Amen.",
    en: "Eternal rest grant unto him, O Lord, and let perpetual light shine upon him. May he rest in peace. Amen.",
    enF: "Eternal rest grant unto her, O Lord, and let perpetual light shine upon her. May she rest in peace. Amen.",
  },
  {
    kind: "bible",
    ref: "Apocalypse 21:4",
    fr: "Il essuiera toute larme de leurs yeux, et la mort ne sera plus, et il n’y aura plus ni deuil, ni cri, ni douleur, car les premières choses ont disparu.",
    en: "And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away.",
  },
  {
    kind: "priere",
    fr: "Que la terre te soit légère, {p}. Ce que tu as planté continue de grandir dans tes enfants et tes petits-enfants.",
    en: "May the earth rest lightly on you, {p}. What you planted keeps growing in your children and grandchildren.",
  },
  {
    kind: "bible",
    ref: "Jean 14:1-2",
    fr: "Que votre cœur ne se trouble point. Croyez en Dieu, et croyez en moi. Il y a plusieurs demeures dans la maison de mon Père.",
    en: "Let not your heart be troubled: ye believe in God, believe also in me. In my Father's house are many mansions.",
  },
  {
    kind: "priere",
    fr: "Notre Père qui es aux cieux ! Que ton nom soit sanctifié ; que ton règne vienne ; que ta volonté soit faite sur la terre comme au ciel. Donne-nous aujourd’hui notre pain quotidien ; pardonne-nous nos offenses, comme nous aussi nous pardonnons à ceux qui nous ont offensés ; ne nous induis pas en tentation, mais délivre-nous du malin.",
    en: "Our Father which art in heaven, Hallowed be thy name. Thy kingdom come. Thy will be done in earth, as it is in heaven. Give us this day our daily bread. And forgive us our debts, as we forgive our debtors. And lead us not into temptation, but deliver us from evil.",
  },
  {
    kind: "bible",
    ref: "Matthieu 5:4",
    fr: "Heureux les affligés, car ils seront consolés !",
    en: "Blessed are they that mourn: for they shall be comforted.",
  },
  {
    kind: "bible",
    ref: "1 Thessaloniciens 4:13-14",
    fr: "Nous ne voulons pas, frères, que vous soyez dans l’ignorance au sujet de ceux qui dorment, afin que vous ne vous affligiez pas comme les autres qui n’ont point d’espérance. Car, si nous croyons que Jésus est mort et qu’il est ressuscité, croyons aussi que Dieu ramènera par Jésus et avec lui ceux qui sont morts.",
    en: "But I would not have you to be ignorant, brethren, concerning them which are asleep, that ye sorrow not, even as others which have no hope. For if we believe that Jesus died and rose again, even so them also which sleep in Jesus will God bring with him.",
  },
  {
    kind: "priere",
    fr: "Repose en paix, {p}. Ta famille porte ton nom avec fierté et raconte ton histoire aux enfants.",
    en: "Rest in peace, {p}. Your family carries your name with pride and tells your story to the children.",
  },
  {
    kind: "bible",
    ref: "Romains 14:8",
    fr: "Car si nous vivons, nous vivons pour le Seigneur ; et si nous mourons, nous mourons pour le Seigneur. Soit donc que nous vivions, soit que nous mourions, nous sommes au Seigneur.",
    en: "For whether we live, we live unto the Lord; and whether we die, we die unto the Lord: whether we live therefore, or die, we are the Lord's.",
  },
  {
    kind: "bible",
    ref: "Ecclésiaste 3:1-2",
    fr: "Il y a un temps pour tout, un temps pour toute chose sous les cieux : un temps pour naître, et un temps pour mourir.",
    en: "To every thing there is a season, and a time to every purpose under the heaven: a time to be born, and a time to die.",
  },
  {
    kind: "bible",
    ref: "Psaume 34:19",
    fr: "L’Éternel est près de ceux qui ont le cœur brisé, et il sauve ceux qui ont l’esprit dans l’abattement.",
    en: "The Lord is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.",
  },
  {
    kind: "bible",
    ref: "2 Timothée 4:7",
    fr: "J’ai combattu le bon combat, j’ai achevé la course, j’ai gardé la foi.",
    en: "I have fought a good fight, I have finished my course, I have kept the faith.",
  },
  {
    kind: "bible",
    ref: "Psaume 116:15",
    fr: "Elle a du prix aux yeux de l’Éternel, la mort de ceux qui l’aiment.",
    en: "Precious in the sight of the Lord is the death of his saints.",
  },
];

const REF_EN: Record<string, string> = {
  "Jean 11:25-26": "John 11:25-26",
  "Psaume 23:1, 4": "Psalm 23:1, 4",
  "Apocalypse 21:4": "Revelation 21:4",
  "Jean 14:1-2": "John 14:1-2",
  "Matthieu 5:4": "Matthew 5:4",
  "1 Thessaloniciens 4:13-14": "1 Thessalonians 4:13-14",
  "Romains 14:8": "Romans 14:8",
  "Ecclésiaste 3:1-2": "Ecclesiastes 3:1-2",
  "Psaume 34:19": "Psalm 34:18",
  "2 Timothée 4:7": "2 Timothy 4:7",
  "Psaume 116:15": "Psalm 116:15",
};

export function readingText(r: Reading, lang: Lang, givenName: string, sex: "m" | "f") {
  const en = lang === "en";
  const text = en ? (sex === "f" && r.enF) || r.en : (sex === "f" && r.frF) || r.fr;
  return { text: text.split("{p}").join(givenName), ref: r.ref ? (en ? REF_EN[r.ref] ?? r.ref : r.ref) : undefined };
}
