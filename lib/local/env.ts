// L'application tourne-t-elle dans une page intégrée (démo partagée) ?
export const embedded = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

type ClaudeHost = { use?: (name: string) => Promise<unknown> };

/** Enregistrement d'un fichier quand l'application est une page partagée (démo). */
export async function hostSave(filename: string, data: Blob): Promise<boolean> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (!host?.use) return false;
  const dl = (await host.use("downloads").catch(() => null)) as { save: (r: { filename: string; data: Blob }) => Promise<unknown> } | null;
  if (!dl) return false;
  try {
    await dl.save({ filename, data });
  } catch (e) {
    if ((e as { code?: string }).code === "declined") return true;
    return false;
  }
  return true;
}
