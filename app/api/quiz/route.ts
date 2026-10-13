import type { NextRequest } from "next/server";
import { body, fail, int, needMember, ok } from "@/lib/server/api";
import { mutate, newId, read } from "@/lib/server/store";

// Tous les membres jouent au quiz et cumulent des points (classement de la famille).
export async function POST(req: NextRequest) {
  const { v, err } = needMember(req);
  if (err) return err;
  const b = await body(req);
  const total = int(b.total, 1, 20);
  const correct = int(b.correct, 0, 20);
  const points = int(b.points, 0, 1000);
  if (total === undefined || correct === undefined || points === undefined || correct > total || points > total * 25 + 50) return fail("Partie invalide.");
  const me = read().persons.find((p) => p.id === v.user!.personId);
  await mutate((s) => {
    s.quizScores.push({ id: newId(), userId: v.user!.id, name: me?.givenName ?? v.user!.name, points, correct, total, createdAt: Date.now() });
    if (s.quizScores.length > 2000) s.quizScores = s.quizScores.slice(-2000);
  });
  return ok();
}
