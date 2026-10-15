import { isNative } from "@/lib/native";
import { DIR } from "./autosave";

// « Restaurer une sauvegarde » : l'application cherche elle-même le fichier dans
// Documents › NosRacines (là où vont les sauvegardes automatiques), le plus récent d'abord.
// Rien trouvé (ou fichier illisible) : on ouvre le sélecteur de fichiers comme avant.

export interface FoundBackup {
  file: File;
  familyName: string;
  date: number;
}

export async function findPhoneBackup(familyId?: string): Promise<FoundBackup | null> {
  if (!isNative) return null;
  try {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    try {
      const p = await Filesystem.checkPermissions();
      if (p.publicStorage !== "granted") await Filesystem.requestPermissions();
    } catch {}
    const { files } = await Filesystem.readdir({ path: DIR, directory: Directory.Documents });
    const list = files.filter((f) => f.type !== "directory" && /\.json$/i.test(f.name)).sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0));
    for (const f of list.slice(0, 8)) {
      try {
        const r = await Filesystem.readFile({ path: `${DIR}/${f.name}`, directory: Directory.Documents, encoding: Encoding.UTF8 });
        const text = typeof r.data === "string" ? r.data : await (r.data as Blob).text();
        const data = JSON.parse(text) as { format?: string; store?: { family?: { id?: string; name?: string } } };
        if (data.format !== "nos-racines-sauvegarde" || !data.store?.family) continue;
        if (familyId && data.store.family.id !== familyId) continue;
        return { file: new File([text], f.name, { type: "application/json" }), familyName: data.store.family.name ?? "", date: f.mtime ?? Date.now() };
      } catch {}
    }
  } catch {}
  return null;
}
