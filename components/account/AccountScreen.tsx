"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Dust, Grain, Vignette } from "@/components/ambiance";
import { Logo } from "@/components/Logo";
import { resetPassword, signIn, signUp } from "@/lib/cloud";
import { useT } from "@/lib/i18n/client";
import { kv } from "@/lib/local/store-core";
import { sound } from "@/lib/sound";

// Chaque personne a son propre compte : e-mail et mot de passe.
// Le même compte s'ouvre sur n'importe quel téléphone, et la famille revient toute seule.

const input =
  "w-full rounded-[14px] border border-or-pale/30 bg-coton/10 px-4 py-3.5 text-[16px] text-coton outline-none placeholder:text-or-pale/40 focus:border-or";

export function AccountScreen({ familyName }: { familyName?: string }) {
  const t = useT();
  const invited = !!kv.get("nr_invitation");
  const [mode, setMode] = useState<"inscription" | "connexion" | "oubli">(invited ? "inscription" : "connexion");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      if (mode === "inscription") {
        if (pw.length < 8) throw new Error(t("Le mot de passe doit avoir au moins 8 caractères."));
        const r = await signUp(email, pw, name);
        if (r === "confirmer") {
          setMode("connexion");
          setNote(t("Compte créé. Ouvrez l’e-mail reçu et touchez le lien de confirmation, puis revenez vous connecter ici."));
        } else sound.play("success");
      } else if (mode === "connexion") {
        await signIn(email, pw);
        sound.play("success");
      } else {
        await resetPassword(email);
        setNote(t("Un e-mail vient de partir. Touchez le lien qu’il contient pour choisir un nouveau mot de passe, puis revenez vous connecter."));
        setMode("connexion");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col justify-center overflow-hidden bg-nuit px-6 pb-10 pt-12 text-coton">
      <Vignette />
      <Dust />
      <Grain />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative mx-auto w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center">
          <Logo size={64} />
          <p className="mt-3 font-serif text-xs tracking-[5px] text-or">NOS RACINES</p>
          <h1 className="mt-4 font-serif text-[30px] font-light leading-tight">
            {invited ? t("Vous êtes invité(e)") : mode === "inscription" ? t("Créer mon compte") : mode === "oubli" ? t("Mot de passe oublié") : t("Bon retour")}
          </h1>
          {familyName && <p className="mt-1 font-main text-2xl text-or-pale">{familyName}</p>}
          <p className="mt-2 text-[14px] leading-relaxed text-or-pale">
            {mode === "oubli"
              ? t("Tapez l’e-mail de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.")
              : t("Un compte personnel, pour retrouver votre famille sur n’importe quel téléphone. L’arbre est le même pour tous les membres.")}
          </p>
        </div>

        {mode !== "oubli" && (
          <div className="mt-6 grid grid-cols-2 rounded-full border border-or-pale/25 p-1 text-[14px]">
            {(["inscription", "connexion"] as const).map((m) => (
              <button key={m} type="button" onClick={() => (setMode(m), setError(null))} className={`min-h-11 rounded-full ${mode === m ? "bg-or font-semibold text-nuit" : "text-or-pale"}`}>
                {m === "inscription" ? t("Nouveau compte") : t("J’ai déjà un compte")}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {mode === "inscription" && (
              <motion.div key="nom" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" placeholder={t("Prénom et nom")} aria-label={t("Prénom et nom")} className={input} />
              </motion.div>
            )}
          </AnimatePresence>
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder={t("Adresse e-mail")} aria-label={t("Adresse e-mail")} className={input} />
          {mode !== "oubli" && (
            <div className="relative">
              <input value={pw} onChange={(e) => setPw(e.target.value)} required type={show ? "text" : "password"} minLength={mode === "inscription" ? 8 : 1} autoComplete={mode === "inscription" ? "new-password" : "current-password"} placeholder={t("Mot de passe")} aria-label={t("Mot de passe")} className={`${input} pr-24`} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 px-2 text-[12px] text-or-pale/80">
                {show ? t("Masquer") : t("Afficher")}
              </button>
            </div>
          )}
          {mode === "inscription" && <p className="text-[12px] text-or-pale/70">{t("8 caractères au moins. Notez-le bien : il ouvre votre compte sur un autre téléphone.")}</p>}
          {error && <p role="alert" className="rounded-[14px] bg-terre/25 px-3.5 py-2.5 text-[13px] text-[#F3C9B8]">{error}</p>}
          {note && <p className="rounded-[14px] bg-or/15 px-3.5 py-2.5 text-[13px] leading-relaxed text-or-pale">{note}</p>}
          <button type="submit" disabled={busy} className="mt-1 min-h-[54px] rounded-full bg-or text-[15px] font-semibold text-nuit shadow-or disabled:opacity-60">
            {busy ? "…" : mode === "inscription" ? t("Créer mon compte") : mode === "oubli" ? t("Recevoir le lien") : t("Me connecter")}
          </button>
        </form>
        <div className="mt-4 text-center">
          {mode === "connexion" && (
            <button type="button" onClick={() => (setMode("oubli"), setError(null))} className="min-h-11 text-[13px] text-or-pale/80 underline underline-offset-4">
              {t("Mot de passe oublié ?")}
            </button>
          )}
          {mode === "oubli" && (
            <button type="button" onClick={() => setMode("connexion")} className="min-h-11 text-[13px] text-or-pale/80 underline underline-offset-4">
              {t("Retour")}
            </button>
          )}
        </div>
      </motion.div>
    </main>
  );
}
