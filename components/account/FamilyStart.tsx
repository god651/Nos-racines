"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Dust, Grain, Vignette } from "@/components/ambiance";
import { ScanButton } from "@/components/Scanner";
import { getSession, myEmail, signOut } from "@/lib/cloud";
import { useT } from "@/lib/i18n/client";
import { navigate } from "@/lib/local/router";
import { kv, read } from "@/lib/local/store-core";
import { connectFamily, enableSharing, fetchMe, joinWithCode, requestJoin, type MeInfo } from "@/lib/local/sync";
import { sound } from "@/lib/sound";

// Compte ouvert, mais ce téléphone n'est relié à aucune famille :
// on retrouve la sienne, on en crée une, on met en ligne celle du téléphone, ou on en rejoint une.

export function FamilyStart() {
  const t = useT();
  const [me, setMe] = useState<MeInfo | null>(null);
  const [busy, setBusy] = useState<string | null>("chargement");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const local = read().family;
  const once = useRef(false);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      sound.play("success");
      navigate("/accueil", true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function load() {
    setBusy("chargement");
    setError(null);
    try {
      const m = await fetchMe();
      setMe(m);
      // Invitation reçue (QR code scanné avant de se connecter) : on l'utilise tout de suite.
      const inv = kv.get("nr_invitation");
      if (inv) {
        kv.del("nr_invitation");
        return await run("rejoindre", () => joinWithCode(inv));
      }
      const active = m.families.filter((f) => f.status === "actif");
      if (active.length === 1) return await run("ouverture", () => connectFamily(active[0].family_id));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  }
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const active = me?.families.filter((f) => f.status === "actif") ?? [];
  const pending = me?.families.filter((f) => f.status === "en_attente") ?? [];
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");

  return (
    <main className="relative min-h-dvh overflow-hidden bg-nuit px-6 pb-10 pt-14 text-coton">
      <Vignette />
      <Dust />
      <Grain />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative mx-auto max-w-[420px]">
        <p className="font-serif text-sm tracking-[5px] text-or">NOS RACINES</p>
        <h1 className="mt-4 font-serif text-[30px] font-light leading-tight">{(() => {
            const n = me?.user.display_name || (getSession()?.user.user_metadata as { name?: string } | undefined)?.name;
            return n ? t("Bonjour {nom}", { nom: n.split(" ")[0] }) : t("Votre famille");
          })()}</h1>
        <p className="mt-1 text-[13px] text-or-pale/80">{myEmail()}</p>

        {busy && (
          <p className="mt-8 text-[15px] text-or-pale">
            {busy === "ouverture" || busy === "rejoindre" ? t("Votre famille arrive sur ce téléphone…") : busy === "enligne" ? t("Mise en ligne de la famille…") : t("Un instant…")}
          </p>
        )}
        {error && <p role="alert" className="mt-5 rounded-[14px] bg-terre/25 px-3.5 py-2.5 text-[13px] text-[#F3C9B8]">{error}</p>}

        {!busy && me && (
          <div className="mt-6 space-y-4">
            {active.length > 1 && (
              <section className="rounded-[22px] border border-or/40 bg-coton/5 p-4">
                <p className="text-[14px] font-semibold text-or">{t("Vos familles")}</p>
                <div className="mt-2 space-y-2">
                  {active.map((f) => (
                    <button key={f.family_id} onClick={() => void run("ouverture", () => connectFamily(f.family_id))} className="flex min-h-12 w-full items-center justify-between rounded-[14px] bg-coton/10 px-4 text-left text-[15px]">
                      {f.name}
                      <span className="text-[12px] text-or-pale">{f.role === "admin" ? t("Administrateur") : f.role === "editeur" ? t("Éditeur") : t("Lecteur")}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {pending.map((f) => (
              <section key={f.family_id} className="rounded-[22px] border border-or/40 bg-or/10 p-4 text-[14px] leading-relaxed">
                <p className="font-semibold text-or">{f.name}</p>
                <p className="mt-1 text-or-pale">{t("Votre demande est envoyée. Un administrateur de la famille doit l’accepter.")}</p>
                <button onClick={() => void load()} className="mt-3 min-h-11 rounded-full border border-or px-4 text-[13px] text-or">
                  {t("Vérifier maintenant")}
                </button>
              </section>
            ))}

            {local && !active.some((f) => f.family_id === local.id) && (
              <section className="rounded-[22px] border border-or/40 bg-coton/5 p-4">
                <p className="text-[14px] font-semibold text-or">{t("Mettre en ligne « {nom} »", { nom: local.name })}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-or-pale">
                  {t("La famille de ce téléphone devient la famille en ligne : un seul arbre, le même pour tous. Vous en êtes l’administrateur principal ; les autres la rejoignent avec un QR code.")}
                </p>
                <button onClick={() => void run("enligne", () => enableSharing())} className="mt-3 min-h-12 w-full rounded-full bg-or text-[15px] font-semibold text-nuit">
                  {t("Mettre la famille en ligne")}
                </button>
              </section>
            )}

            <section className="rounded-[22px] border border-or/40 bg-coton/5 p-4">
              <p className="text-[14px] font-semibold text-or">{t("Rejoindre une famille")}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-or-pale">
                {t("Scannez le QR code « Rejoindre » qu’un administrateur vous montre, ou tapez son code (8 caractères). Vous pouvez aussi taper l’identifiant de la famille (6 caractères) : un administrateur acceptera votre demande.")}
              </p>
              <ScanButton label={t("Scanner le QR code")} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-or text-[15px] font-semibold text-nuit" />
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (clean.length === 6)
                    void (async () => {
                      setBusy("demande");
                      setError(null);
                      try {
                        const r = await requestJoin(clean);
                        setSent(r.name);
                        await load();
                      } catch (err) {
                        setError((err as Error).message);
                        setBusy(null);
                      }
                    })();
                  else void run("rejoindre", () => joinWithCode(clean));
                }}
              >
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t("Code ou identifiant")}
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="min-h-12 min-w-0 flex-1 rounded-[14px] border border-or-pale/30 bg-coton/10 px-3 text-center font-serif text-[18px] tracking-[3px] text-coton outline-none placeholder:text-[14px] placeholder:tracking-normal placeholder:text-or-pale/40 focus:border-or"
                />
                <button type="submit" disabled={clean.length !== 6 && clean.length !== 8} className="min-h-12 rounded-full border border-or px-5 text-[14px] text-or disabled:opacity-40">
                  {t("Valider")}
                </button>
              </form>
              {sent && <p className="mt-2 text-[13px] text-or-pale">{t("Demande envoyée à {nom}.", { nom: sent })}</p>}
            </section>

            {!local && (
              <section className="rounded-[22px] border border-or-pale/25 bg-coton/5 p-4">
                <p className="text-[14px] font-semibold text-or">{t("Créer une nouvelle famille")}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-or-pale">{t("Vous plantez l’arbre et vous en devenez l’administrateur principal.")}</p>
                <button onClick={() => navigate("/creer")} className="mt-3 min-h-12 w-full rounded-full border border-or text-[14px] text-or">
                  {t("Créer la famille")}
                </button>
              </section>
            )}

            <div className="pt-2 text-center">
              <button onClick={() => void signOut()} className="min-h-11 text-[13px] text-or-pale/70 underline underline-offset-4">
                {t("Changer de compte")}
              </button>
            </div>
          </div>
        )}
        {!busy && !me && (
          <button onClick={() => void load()} className="mt-6 min-h-12 w-full rounded-full bg-or text-[15px] font-semibold text-nuit">
            {t("Réessayer")}
          </button>
        )}
      </motion.div>
    </main>
  );
}
