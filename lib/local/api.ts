import { NextRequest, NextResponse } from "next/server";
import { match } from "./router";
import * as capsules from "@/app/api/capsules/route";
import * as comptes from "@/app/api/comptes/route";
import * as createur from "@/app/api/createur/route";
import * as exporter from "@/app/api/export/route";
import * as famille from "@/app/api/famille/route";
import * as exemple from "@/app/api/famille/exemple/route";
import * as griot from "@/app/api/griot/route";
import * as hommages from "@/app/api/hommages/route";
import * as hommage from "@/app/api/hommages/[id]/route";
import * as invitations from "@/app/api/invitations/route";
import * as langue from "@/app/api/langue/route";
import * as medias from "@/app/api/medias/route";
import * as parametres from "@/app/api/parametres/route";
import * as personnes from "@/app/api/personnes/route";
import * as personne from "@/app/api/personnes/[id]/route";
import * as recits from "@/app/api/recits/route";
import * as recit from "@/app/api/recits/[id]/route";
import * as rejoindre from "@/app/api/rejoindre/route";
import * as quiz from "@/app/api/quiz/route";
import * as souvenirs from "@/app/api/souvenirs/route";
import * as souvenir from "@/app/api/souvenirs/[id]/route";
import * as statut from "@/app/api/statut/route";
import * as traduire from "@/app/api/traduire/route";
import * as utilisateur from "@/app/api/utilisateurs/[id]/route";

// Le « serveur » de la famille, exécuté dans le téléphone : mêmes règles qu'avant
// (droits des administrateurs, vérifications), sans ordinateur ni Internet.

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse> | NextResponse;
const ROUTES: [string, Record<string, unknown>][] = [
  ["/api/capsules", capsules],
  ["/api/comptes", comptes],
  ["/api/createur", createur],
  ["/api/export", exporter],
  ["/api/famille", famille],
  ["/api/famille/exemple", exemple],
  ["/api/griot", griot],
  ["/api/hommages", hommages],
  ["/api/hommages/:id", hommage],
  ["/api/invitations", invitations],
  ["/api/langue", langue],
  ["/api/medias", medias],
  ["/api/parametres", parametres],
  ["/api/personnes", personnes],
  ["/api/personnes/:id", personne],
  ["/api/recits", recits],
  ["/api/recits/:id", recit],
  ["/api/rejoindre", rejoindre],
  ["/api/quiz", quiz],
  ["/api/souvenirs", souvenirs],
  ["/api/souvenirs/:id", souvenir],
  ["/api/statut", statut],
  ["/api/traduire", traduire],
  ["/api/utilisateurs/:id", utilisateur],
];

export async function localFetch(url: string, method = "GET", payload?: unknown): Promise<{ status: number; data: unknown }> {
  const path = url.split("?")[0];
  for (const [pattern, mod] of ROUTES) {
    const params = match(pattern, path);
    if (!params) continue;
    const h = mod[method.toUpperCase()] as Handler | undefined;
    if (!h) return { status: 405, data: { error: "Action impossible." } };
    try {
      const res = await h(new NextRequest(url, method, payload), { params: Promise.resolve(params) });
      return { status: res.status, data: res.data };
    } catch (e) {
      console.error(e);
      return { status: 500, data: { error: "Une erreur est survenue." } };
    }
  }
  return { status: 404, data: { error: "Introuvable" } };
}
