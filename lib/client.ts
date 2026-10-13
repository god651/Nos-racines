"use client";

import { localFetch } from "./local/api";
import { mediaObjectUrl } from "./local/store-core";

// Outils côté téléphone : appels au serveur de la famille et envoi de médias.

export async function api<T = { ok: boolean }>(url: string, method = "POST", data?: unknown): Promise<T> {
  // Copie profonde : comme un vrai envoi, l'appelant ne partage rien avec les données gardées.
  const r = await localFetch(url, method, data === undefined ? undefined : JSON.parse(JSON.stringify(data)));
  const j = (r.data ?? {}) as { error?: string };
  if (r.status >= 400) throw new Error(j.error ?? `Erreur ${r.status}`);
  return JSON.parse(JSON.stringify(j)) as T;
}

/** Réduit une photo avant l'envoi (1600 px, JPEG) : rapide en 3G, léger sur l'ordinateur. */
export async function shrinkImage(file: File | Blob, max = 1600, quality = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadMedia(blob: Blob, opts: { isPublic?: boolean; purpose?: "capsule"; filename?: string } = {}) {
  const fd = new FormData();
  fd.append("file", blob, opts.filename ?? "fichier");
  if (opts.isPublic) fd.append("public", "1");
  if (opts.purpose) fd.append("purpose", opts.purpose);
  const r = await localFetch("/api/medias", "POST", fd);
  const j = (r.data ?? {}) as { error?: string; id: string; url: string };
  if (r.status >= 400) throw new Error(j.error ?? "Envoi impossible");
  return j;
}

export async function uploadPhoto(file: Blob, isPublic = false) {
  const small = await shrinkImage(file);
  return uploadMedia(small, { isPublic, filename: "photo.jpg" });
}

export const mediaUrl = (id?: string) => mediaObjectUrl(id);
