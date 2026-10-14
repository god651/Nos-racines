// Modèle de données de NOS RACINES.
// Une personne n'est pas un compte : l'arbre contient des personnes (vivantes ou disparues),
// et seuls certains appareils sont liés à un utilisateur (administrateur ou membre).

export type Role = "admin" | "membre";
export type Visibility = "public" | "famille";
export type ParentageKind = "biological" | "adoptive" | "fostered" | "guardianship";
export type UnionKind = "civil" | "customary" | "religious";
export type Lang = "fr" | "en" | "bci" | "dyu"; // français, anglais, baoulé, dioula

export const MAX_ADMINS = 3;

export interface TimelineEvent {
  year: number;
  text: string;
}

export interface Person {
  id: string;
  givenName: string;
  familyName: string;
  nickname?: string;
  dayName?: string;
  dayNameMeaning?: string;
  sex: "f" | "m";
  birthYear?: number;
  deathYear?: number;
  isLiving: boolean;
  village?: string;
  city?: string;
  job?: string;
  ethnicity?: string;
  clan?: string;
  bio?: string;
  quote?: string;
  favoriteDishes?: string[]; // plats favoris (5 au maximum)
  /** Portrait vivant pour un défunt (activé par défaut). */
  animatePortrait?: boolean;
  photoId?: string; // photo principale (= photoIds[0])
  photoIds?: string[]; // jusqu'à 3 photos
  birthDate?: string; // AAAA-MM-JJ (facultatif, pour les anniversaires)
  deathDate?: string;
  /** Case « à compléter » créée pour relier deux personnes (ex. le père inconnu d'un cousin). */
  placeholder?: boolean;
  /** La personne a déjà complété sa propre fiche (une seule fois ; ensuite, seuls les administrateurs). */
  selfEditedAt?: number;
  qrCode: string; // code court imprimé sous le portrait (ex. 7K3F)
  visibility: Visibility; // « public » = visible par le QR code, sans compte
  timeline: TimelineEvent[];
  createdAt: number;
}

export interface Union {
  id: string;
  partnerA: string;
  partnerB: string;
  kind: UnionKind;
  rank?: number; // 1re, 2e épouse…
  /** Couple séparé (divorce, séparation) et l'année. Le lien dans l'arbre est en pointillés. */
  separated?: boolean;
  separatedYear?: number;
}

export interface Parentage {
  childId: string;
  parentIds: string[]; // un ou deux parents
  kind: ParentageKind;
}

export interface Story {
  id: string;
  personId: string; // la personne qui raconte
  title: string;
  text?: string; // résumé ou transcription tapée
  audioId?: string;
  durationSec: number;
  language: Lang;
  createdAt: number;
  by: string; // utilisateur
}

export interface Memory {
  id: string;
  personIds: string[];
  caption: string;
  year?: number;
  photoId?: string;
  createdAt: number;
  by: string;
}

export interface Capsule {
  id: string;
  by: string;
  byName: string;
  recipients: string;
  openYear: number;
  kind: "letter" | "audio" | "video";
  text?: string;
  mediaId?: string;
  createdAt: number;
}

/** Hommage au mémorial d'un défunt : une bougie ou un mot. */
export interface Tribute {
  id: string;
  personId: string;
  kind: "candle" | "message";
  text?: string;
  byName: string;
  by: string;
  createdAt: number;
}

/** Une partie de quiz jouée par un membre. */
export interface QuizScore {
  id: string;
  userId: string;
  name: string;
  points: number;
  correct: number;
  total: number;
  createdAt: number;
}

export interface Media {
  id: string;
  kind: "photo" | "audio";
  mime: string;
  file: string;
  size: number;
  isPublic: boolean; // photos de couverture et portraits publics
  createdAt: number;
  by: string;
}

export interface Family {
  id: string;
  name: string;
  village: string;
  since?: number;
  motto: string;
  treeCode: string; // code du QR code « arbre » (lecture seule)
  covers: string[]; // photos du diaporama d'accueil
  /** Le fondateur : seul à pouvoir nommer ou retirer les administrateurs. */
  ownerId?: string;
  /** Visage fondu dans le générique d'ouverture et la couverture (un ancêtre honoré). */
  introPhotoId?: string;
  introCaption?: string;
  /** Lieux placés à la main sur la carte (villages absents de la liste), par nom simplifié. */
  places?: Record<string, { lat: number; lng: number }>;
  createdAt: number;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  personId?: string; // « c'est moi dans l'arbre »
  /** Le créateur de l'application NOS RACINES (lui seul porte le titre de « Fondateur »). */
  creator?: boolean;
  createdAt: number;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: number;
  device?: string;
}

export interface Invite {
  token: string;
  createdAt: number;
  createdBy: string;
  revoked?: boolean;
  uses: number;
  /** Lien d'appareil : ouvre le compte d'un utilisateur précis sur un autre téléphone (usage unique, 30 min). */
  forUserId?: string;
  /** « account » : code d'accès d'un compte créé par le fondateur (valable jusqu'à sa première utilisation). */
  kind?: "device" | "account";
}

export interface Settings {
  translateKey?: string; // clé Google Cloud Translation (facultative)
  onlineFeatures: boolean;
  defaultVisibility: Visibility;
  language: Lang; // langue par défaut de la famille
}

export interface Store {
  version: 2;
  family: Family | null;
  users: User[];
  sessions: Session[];
  invites: Invite[];
  persons: Person[];
  unions: Union[];
  parentages: Parentage[];
  stories: Story[];
  memories: Memory[];
  capsules: Capsule[];
  media: Media[];
  tributes: Tribute[];
  quizScores: QuizScore[];
  settings: Settings;
  translations: Partial<Record<Lang, Record<string, string>>>;
}

export interface Viewer {
  user: User | null;
  role: Role | null;
  isAdmin: boolean;
  isOwner: boolean;
  /** Le créateur de l'application : titre « Fondateur » et espace du fondateur. */
  isCreator: boolean;
}

/** Le fondateur de la famille (à défaut, le premier administrateur). */
export function ownerIdOf(s: { family: Family | null; users: User[] }) {
  if (s.family?.ownerId && s.users.some((u) => u.id === s.family!.ownerId)) return s.family.ownerId;
  return [...s.users].filter((u) => u.role === "admin").sort((a, b) => a.createdAt - b.createdAt)[0]?.id;
}

export const fullName = (p: Pick<Person, "givenName" | "familyName">) => `${p.givenName} ${p.familyName}`.trim();

export const initials = (p: Pick<Person, "givenName" | "familyName">) =>
  ((p.givenName[0] ?? "") + (p.familyName[0] ?? p.givenName[1] ?? "")).toUpperCase();
