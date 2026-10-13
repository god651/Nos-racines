import type { NextRequest } from "next/server";
import { normPlace } from "@/lib/geo";
import { body, fail, int, needAdmin, ok, txt } from "@/lib/server/api";
import { sessionCookie } from "@/lib/server/auth";
import { mutate, newId, read, shortCode } from "@/lib/server/store";
import { clearMedia } from "@/lib/local/store-core";
import type { Person } from "@/lib/types";

// Création de la famille (une seule par ordinateur), modification, réinitialisation.

export async function POST(req: NextRequest) {
  if (read().family) return fail("Une famille existe déjà sur ce téléphone.", 409);
  const b = await body(req);
  const name = txt(b.name, 80);
  const userName = txt(b.userName, 60);
  if (!name || !userName) return fail("Indiquez le nom de la famille et votre prénom.");

  const token = newId(32);
  await mutate((s) => {
    const now = Date.now();
    s.family = { id: newId(), name, village: txt(b.village, 80) ?? "", motto: txt(b.motto, 140) ?? "", since: int(b.since, 1000, 2100), treeCode: shortCode(6), covers: [], createdAt: now };
    const user = { id: newId(), name: userName, role: "admin" as const, createdAt: now };
    if (b.addSelf) {
      // Le fondateur peut se placer tout de suite dans l'arbre.
      const p: Person = {
        id: newId(),
        givenName: userName,
        familyName: txt(b.userFamilyName, 60) ?? name.replace(/^famille\s+/i, ""),
        sex: b.sex === "f" ? "f" : "m",
        birthYear: int(b.birthYear, 1850, 2100),
        isLiving: true,
        qrCode: shortCode(4),
        visibility: "famille",
        timeline: [],
        createdAt: now,
      };
      s.persons.push(p);
      Object.assign(user, { personId: p.id });
    }
    s.users.push(user);
    s.family!.ownerId = user.id;
    s.sessions.push({ token, userId: user.id, createdAt: now });
  });
  const res = ok({ ok: true });
  res.cookies.set(sessionCookie(token));
  return res;
}

export async function PATCH(req: NextRequest) {
  const { err } = needAdmin(req);
  if (err) return err;
  const b = await body(req);
  await mutate((s) => {
    const f = s.family!;
    if (b.name !== undefined) f.name = txt(b.name, 80) ?? f.name;
    if (b.village !== undefined) f.village = txt(b.village, 80) ?? "";
    if (b.motto !== undefined) f.motto = txt(b.motto, 140) ?? "";
    if (b.since !== undefined) f.since = int(b.since, 1000, 2100);
    if (Array.isArray(b.covers)) f.covers = (b.covers as unknown[]).filter((x): x is string => typeof x === "string" && s.media.some((m) => m.id === x)).slice(0, 20);
    if (b.regenerateTreeCode) f.treeCode = shortCode(6);
    if (b.introPhotoId !== undefined) f.introPhotoId = typeof b.introPhotoId === "string" && s.media.some((m) => m.id === b.introPhotoId) ? b.introPhotoId : undefined;
    if (b.introCaption !== undefined) f.introCaption = txt(b.introCaption, 80);
    // Un lieu placé à la main sur la carte : { place: { name, lat, lng } } (lat absent = retirer).
    const pl = b.place as { name?: unknown; lat?: unknown; lng?: unknown } | undefined;
    if (pl && typeof pl.name === "string" && pl.name.trim()) {
      const key = normPlace(pl.name).slice(0, 80);
      f.places = { ...(f.places ?? {}) };
      if (typeof pl.lat === "number" && typeof pl.lng === "number" && Math.abs(pl.lat) <= 90 && Math.abs(pl.lng) <= 180) f.places[key] = { lat: Math.round(pl.lat * 1e4) / 1e4, lng: Math.round(pl.lng * 1e4) / 1e4 };
      else delete f.places[key];
    }
  });
  return ok();
}

/** Réinitialisation complète (administrateur, confirmation écrite). */
export async function DELETE(req: NextRequest) {
  const { err } = needAdmin(req);
  if (err) return err;
  const b = await body(req);
  const fam = read().family;
  if (!fam || txt(b.confirm, 80)?.toLowerCase() !== fam.name.toLowerCase()) return fail("Tapez exactement le nom de la famille pour confirmer.");
  await mutate((s) => {
    Object.assign(s, {
      family: null, users: [], sessions: [], invites: [], persons: [], unions: [], parentages: [],
      stories: [], memories: [], capsules: [], media: [],
    });
  });
  await clearMedia();
  return ok();
}
