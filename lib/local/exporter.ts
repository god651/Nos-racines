import { isNative, shareFile } from "@/lib/native";
import { embedded, hostSave } from "./env";

/** Enregistre un fichier hors de l'application (galerie, WhatsApp, Drive…). */
export async function exportBlob(name: string, blob: Blob) {
  if (isNative) {
    try {
      await shareFile(name, blob);
    } catch (e) {
      if (!/cancel/i.test((e as Error).message ?? "")) throw e;
    }
    return;
  }
  if (embedded && (await hostSave(name, blob))) return;
  const file = new File([blob], name, { type: blob.type });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
  "audio/webm": "webm", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/ogg": "ogg",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/3gpp": "3gp",
};
export const extFor = (mime?: string) => EXT[(mime ?? "").split(";")[0]] ?? "bin";
