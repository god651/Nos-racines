import type { NextRequest } from "next/server";
import { needEditor, ok } from "@/lib/server/api";
import { mutate } from "@/lib/server/store";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = needEditor(req);
  if (err) return err;
  const { id } = await params;
  await mutate((s) => {
    s.memories = s.memories.filter((x) => x.id !== id);
  });
  return ok();
}
