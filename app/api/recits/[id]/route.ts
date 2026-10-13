import type { NextRequest } from "next/server";
import { body, needAdmin, ok, txt } from "@/lib/server/api";
import { mutate } from "@/lib/server/store";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = needAdmin(req);
  if (err) return err;
  const { id } = await params;
  const b = await body(req);
  await mutate((s) => {
    const st = s.stories.find((x) => x.id === id);
    if (!st) return;
    if ("title" in b) st.title = txt(b.title, 140) ?? st.title;
    if ("text" in b) st.text = txt(b.text, 20000);
  });
  return ok();
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { err } = needAdmin(req);
  if (err) return err;
  const { id } = await params;
  await mutate((s) => {
    s.stories = s.stories.filter((x) => x.id !== id);
  });
  return ok();
}
