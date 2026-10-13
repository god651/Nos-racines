import { redirect } from "next/navigation";
import { FounderView, type FeedItem } from "@/components/FounderView";
import { requireMember } from "@/lib/server/page";
import { fullName } from "@/lib/types";

// Espace du fondateur (lui seul) : la vie de la famille dans l'application, jour après jour.
export default async function FondateurPage() {
  const { s, family, viewer } = await requireMember();
  if (!viewer.isOwner) redirect("/accueil");
  const userName = (id: string) => s.users.find((u) => u.id === id)?.name ?? "—";
  const personName = (id: string) => {
    const p = s.persons.find((x) => x.id === id);
    return p ? fullName(p) : "—";
  };
  const feed: FeedItem[] = [
    ...s.persons.filter((p) => !p.placeholder).map((p) => ({ at: p.createdAt, kind: "personne" as const, text: fullName(p) })),
    ...s.stories.map((x) => ({ at: x.createdAt, kind: "recit" as const, text: x.title || personName(x.personId), who: userName(x.by) })),
    ...s.memories.map((x) => ({ at: x.createdAt, kind: "souvenir" as const, text: x.caption, who: userName(x.by) })),
    ...s.tributes.map((x) => ({ at: x.createdAt, kind: x.kind === "candle" ? ("bougie" as const) : ("mot" as const), text: personName(x.personId), who: x.byName })),
    ...s.quizScores.map((x) => ({ at: x.createdAt, kind: "quiz" as const, text: `${x.points} pts`, who: x.name })),
    ...s.users.map((u) => ({ at: u.createdAt, kind: "compte" as const, text: u.name })),
    ...s.capsules.map((c) => ({ at: c.createdAt, kind: "capsule" as const, text: String(c.openYear), who: c.byName })),
  ].sort((a, b) => b.at - a.at);
  const lastSeen = new Map<string, number>();
  for (const se of s.sessions) lastSeen.set(se.userId, Math.max(lastSeen.get(se.userId) ?? 0, se.createdAt));
  return (
    <FounderView
      familyName={family.name}
      since={family.createdAt}
      totals={{
        persons: s.persons.filter((p) => !p.placeholder).length,
        stories: s.stories.length,
        voiceMin: Math.round(s.stories.reduce((t, x) => t + (x.durationSec || 0), 0) / 60),
        memories: s.memories.length,
        capsules: s.capsules.length,
        candles: s.tributes.filter((x) => x.kind === "candle").length,
        messages: s.tributes.filter((x) => x.kind === "message").length,
        quiz: s.quizScores.length,
        photos: s.media.filter((m) => m.kind === "photo").length,
      }}
      accounts={s.users
        .map((u) => ({ id: u.id, name: u.name, admin: u.role === "admin", owner: u.id === family.ownerId, since: u.createdAt, lastSeen: lastSeen.get(u.id) }))
        .sort((a, b) => Number(b.owner) - Number(a.owner) || a.since - b.since)}
      feed={feed}
    />
  );
}
