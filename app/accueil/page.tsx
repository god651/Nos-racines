import { HomeView } from "@/components/HomeView";
import { familyStats, formatVoice } from "@/lib/genealogy";
import { anniversaries } from "@/lib/anniversaries";
import { requireMember } from "@/lib/server/page";
import { fullName } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AccueilPage() {
  const { s, family, viewer } = await requireMember();
  const st = familyStats(s);
  const voice = formatVoice(st.voiceSec);
  // « Une voix à écouter aujourd'hui » : un récit différent chaque jour.
  const withAudio = s.stories.filter((x) => x.audioId);
  const day = Math.floor(Date.now() / 86400000);
  const story = withAudio.length ? withAudio[day % withAudio.length] : s.stories[s.stories.length - 1];
  const teller = story ? s.persons.find((p) => p.id === story.personId) : undefined;
  const me = viewer.user!.personId ? s.persons.find((p) => p.id === viewer.user!.personId) : undefined;
  return (
    <HomeView
      d={{
        family: { name: family.name, village: family.village, motto: family.motto },
        face: family.introPhotoId,
        covers: family.covers.filter((id) => s.media.some((m) => m.id === id)),
        stats: { members: st.members, generations: st.generations, memories: st.memories, voiceValue: voice.value, voiceUnit: voice.unit },
        userName: me?.givenName ?? viewer.user!.name,
        isAdmin: viewer.canEdit,
        invited: s.users.length > 1 || s.invites.some((i) => !i.forUserId),
        featured: story
          ? { title: story.title, personName: teller ? fullName(teller) : "", personId: story.personId, audioId: story.audioId, photoId: teller?.photoId, minutes: Math.max(1, Math.round(story.durationSec / 60)) }
          : null,
        annivs: anniversaries(s.persons, 30)
          .slice(0, 5)
          .map((a) => {
            const p = s.persons.find((x) => x.id === a.personId)!;
            return { ...a, date: undefined, givenName: p.givenName, photoId: p.photoId, sex: p.sex, isLiving: p.isLiving };
          }),
        memories: [...s.memories].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10).map((m) => ({ id: m.id, caption: m.caption, year: m.year, photoId: m.photoId })),
      }}
    />
  );
}
