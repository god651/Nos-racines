import { QuizView, type Leader } from "@/components/QuizView";
import { requireMember } from "@/lib/server/page";

export default async function QuizPage() {
  const { s, family, viewer } = await requireMember();
  // Classement : total des points de chaque membre.
  const totals = new Map<string, Leader>();
  for (const q of s.quizScores) {
    const u = s.users.find((x) => x.id === q.userId);
    const cur = totals.get(q.userId) ?? { userId: q.userId, name: u?.name ?? q.name, points: 0, games: 0, best: 0, me: q.userId === viewer.user!.id };
    cur.points += q.points;
    cur.games += 1;
    cur.best = Math.max(cur.best, q.correct);
    totals.set(q.userId, cur);
  }
  const leaders = [...totals.values()].sort((a, b) => b.points - a.points);
  return <QuizView familyName={family.name} leaders={leaders} data={{ persons: s.persons, parentages: s.parentages, unions: s.unions }} />;
}
