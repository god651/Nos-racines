"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Portrait } from "@/components/Portrait";
import { BackButton, ErrorNote } from "@/components/ui";
import { myUid } from "@/lib/cloud";
import { useT } from "@/lib/i18n/client";
import { navigate } from "@/lib/local/router";
import { mediaObjectUrl, read } from "@/lib/local/store-core";
import { claimPerson, getMembers, getSyncStatus, myMember, setMember, subscribeSync } from "@/lib/local/sync";
import { fullName } from "@/lib/types";
import { sound } from "@/lib/sound";

// « C'est moi » : le membre choisit sa fiche dans l'arbre. Un administrateur valide
// (un administrateur se relie lui-même directement). Tant que ce n'est pas fait,
// il est « utilisateur » : il voit la famille mais n'a pas encore de fiche à lui.
export function WhoAmI() {
  const t = useT();
  useSyncExternalStore(subscribeSync, getSyncStatus);
  const me = myMember();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const taken = new Set(getMembers().filter((m) => m.user_id !== myUid()).flatMap((m) => [m.person_id, m.requested_person_id]).filter(Boolean) as string[]);
  const persons = useMemo(() => {
    const n = q.trim().toLowerCase();
    return read()
      .persons.filter((p) => !p.placeholder && p.isLiving !== false && !taken.has(p.id))
      .filter((p) => !n || fullName(p).toLowerCase().includes(n) || (p.nickname ?? "").toLowerCase().includes(n))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)))
      .slice(0, 80);
  }, [q, taken.size]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = me?.person_id ? read().persons.find((p) => p.id === me.person_id) : null;
  const asked = me?.requested_person_id ? read().persons.find((p) => p.id === me.requested_person_id) : null;

  async function choose(pid: string) {
    setBusy(pid);
    setError(null);
    try {
      if (me?.role === "admin") await setMember(me.user_id, { personId: pid });
      else await claimPerson(pid);
      sound.play("success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-dvh bg-coton px-5 pb-28 pt-[52px]">
      <header className="flex items-center gap-3">
        <BackButton href="/moi" />
        <div>
          <p className="font-main text-lg leading-none text-or-fonce">{t("votre place")}</p>
          <h1 className="font-serif text-[26px] text-nuit">{t("Qui êtes-vous dans l’arbre ?")}</h1>
        </div>
      </header>
      {mine ? (
        <div className="mt-6 rounded-[20px] bg-kapok p-4 text-[14px] text-foret">
          {t("Votre compte est relié à la fiche de {nom}.", { nom: fullName(mine) })}
          <button onClick={() => navigate(`/membre/${mine.id}`)} className="mt-3 block min-h-11 rounded-full bg-foret px-5 text-[13px] font-semibold text-coton">
            {t("Voir ma fiche")}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-4 text-[14px] leading-relaxed text-[#5A5A52]">
            {t("Touchez votre fiche. Un administrateur confirmera ; vous pourrez ensuite compléter vos informations, une seule fois. Vous n’êtes pas encore dans l’arbre ? Un administrateur vous y ajoutera : en attendant, vous voyez toute la famille.")}
          </p>
          {asked && <p className="mt-3 rounded-[14px] bg-or/15 px-3.5 py-2.5 text-[13px] text-or-fonce">{t("Demande envoyée : vous êtes {nom}. En attente de la confirmation d’un administrateur.", { nom: fullName(asked) })}</p>}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Chercher mon nom…")} className="mt-4 w-full rounded-[14px] border border-or-pale bg-white px-4 py-3 text-[15px] outline-none focus:border-or" />
          <ErrorNote message={error} />
          <div className="mt-3 space-y-2">
            {persons.map((p) => (
              <button key={p.id} disabled={!!busy} onClick={() => void choose(p.id)} className={`flex w-full items-center gap-3 rounded-[16px] border px-3 py-2.5 text-left ${asked?.id === p.id ? "border-or bg-or/10" : "border-or-pale/60 bg-white"}`}>
                <Portrait src={mediaObjectUrl(p.photoId)} size={42} headwrap={p.sex === "f"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-nuit">{fullName(p)}</span>
                  {p.birthYear && <span className="text-[12px] text-[#6B6455]">{p.birthYear}</span>}
                </span>
                <span className="text-[12px] text-or-fonce">{busy === p.id ? "…" : asked?.id === p.id ? t("Demandé") : t("C’est moi")}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
