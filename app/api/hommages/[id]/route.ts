import type { NextRequest } from "next/server";
import { fail, needMember, ok } from "@/lib/server/api";
import { mutate, read } from "@/lib/server/store";

/** Retirer un mot : son auteur ou un administrateur. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { v, err } = needMember(req);
  if (err) return err;
  const { id } = await params;
  const t = read().tributes.find((x) => x.id === id);
  if (!t) return fail("Introuvable", 404);
  if (t.by !== v.user!.id && !v.isAdmin) return fail("Action réservée aux administrateurs.", 403);
  await mutate((s) => {
    s.tributes = s.tributes.filter((x) => x.id !== id);
  });
  return ok();
}
