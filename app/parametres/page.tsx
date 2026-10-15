import { SettingsView } from "@/components/SettingsView";
import { EN } from "@/lib/i18n/en";
import { requireMember } from "@/lib/server/page";
import { DATA_DIR } from "@/lib/server/store";
import { fullName, MAX_ADMINS, ownerIdOf } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const { s, family, viewer } = await requireMember();
  const used = new Set(family.covers);
  const owner = ownerIdOf(s);
  // Photos déjà dans l'application, proposées pour le diaporama d'accueil.
  const candidates = s.media
    .filter((m) => m.kind === "photo" && !used.has(m.id))
    .filter((m) => s.persons.some((p) => p.photoId === m.id) || s.memories.some((x) => x.photoId === m.id) || m.isPublic)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30)
    .map((m) => m.id);
  const key = s.settings.translateKey ?? "";
  return (
    <SettingsView
      d={{
        isAdmin: viewer.isAdmin,
        canEdit: viewer.canEdit,
        role: viewer.role,
        meId: viewer.user!.id,
        family: { name: family.name, village: family.village, motto: family.motto, since: family.since, introPhotoId: family.introPhotoId, introCaption: family.introCaption },
        covers: family.covers.filter((id) => s.media.some((m) => m.id === id)),
        candidates,
        users: s.users
          .map((u) => {
            const p = u.personId ? s.persons.find((x) => x.id === u.personId) : undefined;
            const code = s.invites.find((i) => i.kind === "account" && i.forUserId === u.id && !i.uses && !i.revoked)?.token;
            return {
              id: u.id,
              name: u.name,
              role: owner === u.id ? ("admin" as const) : u.role,
              personName: p ? fullName(p) : undefined,
              isOwner: owner === u.id,
              isCreator: !!u.creator,
              code: viewer.isAdmin ? code : undefined,
              connected: s.sessions.some((x) => x.userId === u.id),
            };
          })
          .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "admin" ? -1 : 1)),
        isOwner: viewer.isOwner,
        isCreator: viewer.isCreator,
        persons: s.persons.filter((p) => !p.placeholder).map((p) => ({ id: p.id, name: fullName(p) })),
        maxAdmins: MAX_ADMINS,
        settings: {
          onlineFeatures: s.settings.onlineFeatures,
          defaultVisibility: s.settings.defaultVisibility,
          language: s.settings.language,
          keyHint: viewer.isAdmin && key ? `••••${key.slice(-4)}` : key ? "••••" : "",
          envKey: !key && Boolean(process.env.GOOGLE_TRANSLATE_API_KEY),
        },
        translated: { bci: Object.keys(s.translations.bci ?? {}).length, dyu: Object.keys(s.translations.dyu ?? {}).length, total: Object.keys(EN).length },
        about: {
          persons: s.persons.length,
          stories: s.stories.length,
          memories: s.memories.length,
          media: s.media.length,
          mediaMb: Math.round((s.media.reduce((t, m) => t + m.size, 0) / 1048576) * 10) / 10,
          dataDir: viewer.isAdmin ? DATA_DIR : "",
        },
        activeInvites: s.invites.filter((i) => !i.revoked && !i.forUserId).length,
      }}
    />
  );
}
