import { api, uploadMedia } from "@/lib/client";
import { read } from "./store-core";
import { paintScene } from "./demo-art";

// Ajoute à la famille d'exemple des souvenirs illustrés et un diaporama de couverture.
export async function decorateDemo() {
  const s = read();
  const by = (name: string) => s.persons.find((p) => p.givenName === name)?.id;
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    try {
      ids.push((await uploadMedia(await paintScene(i), { isPublic: true, filename: `village-${i}.jpg` })).id);
    } catch {
      /* dessin impossible : la démo continue sans illustration */
    }
  }
  const memories = [
    { caption: "Le grand fromager de Sakassou", year: 1958, personIds: [by("N’Guessan")] },
    { caption: "La plantation au coucher du soleil", year: 1972, personIds: [by("N’Guessan"), by("Yao")] },
    { caption: "Fête des ignames au village", year: 1987, personIds: [by("Yao"), by("Adjoua"), by("Konan")] },
  ];
  for (let i = 0; i < memories.length; i++) {
    await api("/api/souvenirs", "POST", { ...memories[i], personIds: memories[i].personIds.filter(Boolean), photoId: ids[i] }).catch(() => undefined);
  }
  if (ids.length) await api("/api/famille", "PATCH", { covers: ids }).catch(() => undefined);
}
