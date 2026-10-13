import { notFound, redirect } from "next/navigation";
import { MemorialView } from "@/components/MemorialView";
import { anniversaries } from "@/lib/anniversaries";
import { requireMember } from "@/lib/server/page";
import { fullName } from "@/lib/types";

export default async function MemorialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { s, viewer, lang } = await requireMember();
  const p = s.persons.find((x) => x.id === id);
  if (!p) notFound();
  if (p.isLiving) redirect(`/membre/${id}`);
  const today = new Date().toDateString();
  const tributes = s.tributes.filter((x) => x.personId === id);
  const anniv = anniversaries([p], 7)[0] ?? null;
  return (
    <MemorialView
      d={{
        id: p.id,
        givenName: p.givenName,
        name: fullName(p),
        sex: p.sex,
        photoId: p.photoId,
        animated: p.animatePortrait !== false,
        birthYear: p.birthYear,
        deathYear: p.deathYear,
        deathDate: p.deathDate,
        quote: p.quote,
        candles: tributes.filter((x) => x.kind === "candle").length,
        myCandleToday: tributes.some((x) => x.kind === "candle" && x.by === viewer.user!.id && new Date(x.createdAt).toDateString() === today),
        messages: tributes
          .filter((x) => x.kind === "message")
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((x) => ({ id: x.id, byName: x.byName, text: x.text ?? "", createdAt: x.createdAt, canDelete: viewer.isAdmin || x.by === viewer.user!.id })),
        anniv: anniv ? { kind: anniv.kind, inDays: anniv.inDays, years: anniv.years } : null,
        stories: s.stories.filter((x) => x.personId === id).length,
        lang,
      }}
    />
  );
}
