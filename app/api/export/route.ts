import type { NextRequest } from "next/server";
import { needAdmin, ok } from "@/lib/server/api";
import { read } from "@/lib/server/store";

// Sauvegarde : toutes les données de la famille (sans les jetons des appareils).
export async function GET(req: NextRequest) {
  const { err } = needAdmin(req);
  if (err) return err;
  const s = read();
  const { sessions: _s, invites: _i, settings, ...rest } = s;
  void _s;
  void _i;
  return ok({ ...rest, settings: { ...settings, translateKey: undefined }, exportedAt: new Date().toISOString() });
}
