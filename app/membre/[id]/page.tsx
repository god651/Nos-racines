import { notFound } from "next/navigation";
import { MemberView, type MemberData, type RelLink } from "@/components/MemberView";
import { childrenOf, computeGenerations, parentsOf, siblingsOf, spousesOf } from "@/lib/genealogy";
import { baseUrl } from "@/lib/server/auth";
import { requireMember } from "@/lib/server/page";
import { qrSvg } from "@/lib/server/qr";
import { read } from "@/lib/server/store";
import { fullName, type Person } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = read().persons.find((x) => x.id === id);
  return { title: q ? `${fullName(q)} — NOS RACINES` : "NOS RACINES" };
}

const link = (p: Person): RelLink => ({ id: p.id, name: fullName(p), photoId: p.photoId, isLiving: p.isLiving, years: years(p) });
const years = (p: Person) => (p.birthYear ? (p.deathYear ? `${p.birthYear} – ${p.deathYear}` : `${p.birthYear}`) : p.deathYear ? `† ${p.deathYear}` : "");

export default async function MembrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { s, viewer, lang } = await requireMember();
  const p = s.persons.find((x) => x.id === id);
  if (!p) notFound();

  const gens = computeGenerations(s.persons, s.parentages, s.unions);
  const qrLink = `${await baseUrl()}/q/${p.qrCode}`;
  const d: MemberData = {
    id: p.id,
    name: fullName(p),
    givenName: p.givenName,
    nickname: p.nickname,
    sex: p.sex,
    birthYear: p.birthYear,
    deathYear: p.deathYear,
    isLiving: p.isLiving,
    village: p.village,
    city: p.city,
    job: p.job,
    ethnicity: p.ethnicity,
    clan: p.clan,
    dayName: p.dayName,
    dayNameMeaning: p.dayNameMeaning,
    bio: p.bio,
    quote: p.quote,
    favoriteDishes: p.favoriteDishes ?? [],
    photoId: p.photoId,
    photoIds: p.photoIds ?? (p.photoId ? [p.photoId] : []),
    animated: p.animatePortrait !== false,
    isPublic: p.visibility === "public",
    generation: gens.get(p.id) ?? 1,
    timeline: [...p.timeline].sort((a, b) => a.year - b.year),
    stories: s.stories
      .filter((x) => x.personId === p.id)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((x) => ({ id: x.id, title: x.title, text: x.text, audioId: x.audioId, durationSec: x.durationSec })),
    memories: s.memories
      .filter((m) => m.personIds.includes(p.id))
      .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))
      .map((m) => ({ id: m.id, caption: m.caption, year: m.year, photoId: m.photoId })),
    parents: parentsOf(s, p.id).map(link),
    parentKind: s.parentages.find((x) => x.childId === p.id)?.kind,
    spouses: spousesOf(s, p.id).map(({ union, person }) => ({ ...link(person), rank: union.rank, kind: union.kind })),
    children: childrenOf(s, p.id)
      .sort((a, b) => (a.birthYear ?? 9999) - (b.birthYear ?? 9999))
      .map(link),
    siblings: siblingsOf(s, p.id).map(link),
    isMe: viewer.user?.personId === p.id,
    qrSvg: await qrSvg(qrLink),
    qrLink,
    isAdmin: viewer.isAdmin,
    lang,
    online: s.settings.onlineFeatures,
  };
  return <MemberView d={d} />;
}
