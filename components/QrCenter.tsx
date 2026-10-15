"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { embedded } from "@/lib/local/env";
import Link from "next/link";
import { getLink } from "@/lib/local/sync";
import { isNative } from "@/lib/native";
import { useT } from "@/lib/i18n/client";
import { askConfirm } from "@/components/Confirm";
import { sound } from "@/lib/sound";
import { QrBox } from "./QrBox";
import { ErrorNote, GhostButton, PageHeader, PrimaryButton } from "./ui";

interface Props {
  familyName: string;
  isAdmin: boolean;
  tree: { link: string; svg: string; code: string };
  invites: { token: string; link: string; svg: string; uses: number; createdAt: number }[];
  persons: { id: string; name: string; code: string; isPublic: boolean; link: string; svg: string }[];
  local: boolean;
}

type Tab = "arbre" | "inviter" | "membres";

export function QrCenter({ familyName, isAdmin, tree, invites, persons, local }: Props) {
  const t = useT();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(isAdmin ? "inviter" : "arbre");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(link);
      setTimeout(() => setCopied(null), 1800);
    } catch {}
  };
  const share = async (link: string, text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: familyName, text, url: link });
        return;
      } catch {}
    }
    await copy(link);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "arbre", label: t("L’arbre") },
    ...(isAdmin ? [{ id: "inviter" as Tab, label: t("Inviter") }] : []),
    { id: "membres", label: t("Chaque personne") },
  ];

  return (
    <main className="min-h-dvh bg-coton pb-16">
      <div className="print:hidden">
        <PageHeader title={t("QR codes")} kicker={familyName} back="/accueil" />
        {local && (
          <p className="mx-5 mb-3 rounded-[14px] border border-or/40 bg-or/10 px-3.5 py-2.5 text-[13px] leading-snug text-[#5A4A22]">
            {t("L’arbre et les fiches s’ouvrent avec l’appareil photo de n’importe quel téléphone, même sans l’application. Les informations sont dans le QR code lui-même : rien n’est mis sur Internet.")}
          </p>
        )}
        <div role="tablist" className="mx-5 mb-4 flex rounded-full bg-kapok p-1">
          {TABS.map((x) => (
            <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)} className="relative flex-1 rounded-full py-2.5 text-[13px] font-medium">
              {tab === x.id && <motion.span layoutId="qr-tab" className="absolute inset-0 rounded-full bg-coton shadow-doux" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <span className={`relative ${tab === x.id ? "text-nuit" : "text-[#6B6455]"}`}>{x.label}</span>
            </button>
          ))}
        </div>
        <div className="px-5">
          <ErrorNote message={error} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }} className="px-5">
          {tab === "arbre" && (
            <section>
              <BigQr svg={tree.svg} title={t("Voir l’arbre de la famille")} sub={familyName} />
              <p className="mt-4 text-sm leading-relaxed text-[#4A463C] print:hidden">
                {t("Ce QR code montre l’arbre à n’importe qui, sans application ni compte : les noms, les dates et les liens de parenté. Après un changement dans l’arbre, imprimez le nouveau QR code.")}
              </p>
              <LinkRow link={tree.link} copied={copied === tree.link} onCopy={() => copy(tree.link)} onShare={() => share(tree.link, t("L’arbre de la famille {nom}", { nom: familyName }))} />
              <div className="mt-4 flex gap-2 print:hidden">
                {!embedded && !isNative && <GhostButton onClick={() => window.print()} className="flex-1">{t("Imprimer")}</GhostButton>}
              </div>
            </section>
          )}

          {tab === "inviter" && isAdmin && getLink() && (
            <section className="rounded-[20px] bg-kapok p-4 text-center">
              <p className="text-sm leading-relaxed text-[#4A463C]">{t("La famille est en ligne : chaque proche crée son compte puis scanne un QR code d’invitation. Choisissez son rôle (lecteur ou éditeur) et, si vous voulez, sa fiche dans l’arbre.")}</p>
              <Link href="/parametres" className="mt-3 inline-flex min-h-12 items-center rounded-full bg-or px-6 text-[14px] font-semibold text-nuit">
                {t("Créer une invitation")}
              </Link>
            </section>
          )}
          {tab === "inviter" && isAdmin && !getLink() && (
            <section>
              <p className="mb-4 text-sm leading-relaxed text-[#4A463C] print:hidden">
                {t("Votre proche installe l’application Nos Racines, touche « Scanner » et vise ce QR code : il rejoint la famille et peut tout voir, sans rien modifier. Ce code ne s’ouvre qu’avec le scanner de l’application. Vous pourrez ensuite le nommer administrateur dans les paramètres (3 au maximum).")}
              </p>
              {invites.length === 0 ? (
                <PrimaryButton loading={busy} onClick={() => run(async () => { await api("/api/invitations", "POST", {}); sound.play("chime"); })}>
                  {t("Créer un QR code d’invitation")}
                </PrimaryButton>
              ) : (
                <>
                  <BigQr svg={invites[0].svg} title={t("Rejoindre la famille")} sub={familyName} />
                  <p className="mt-2 text-center text-xs text-[#6B6455] print:hidden">
                    {t("Utilisé {n} fois", { n: invites[0].uses })}
                  </p>
                  <LinkRow link={invites[0].link} copied={copied === invites[0].link} onCopy={() => copy(invites[0].link)} onShare={() => share(invites[0].link, t("Rejoins la famille {nom} sur NOS RACINES", { nom: familyName }))} />
                  <div className="mt-4 flex gap-2 print:hidden">
                    <GhostButton disabled={busy} className="flex-1" onClick={() => run(() => api("/api/invitations", "DELETE", { token: invites[0].token }))}>
                      {t("Désactiver")}
                    </GhostButton>
                    <GhostButton disabled={busy} className="flex-1" onClick={() => run(() => api("/api/invitations", "POST", {}))}>
                      {t("Nouveau QR code")}
                    </GhostButton>
                  </div>
                  {invites.length > 1 && (
                    <div className="mt-6 print:hidden">
                      <p className="mb-2 text-[11px] uppercase tracking-[1.5px] text-or-fonce">{t("Autres invitations actives")}</p>
                      {invites.slice(1).map((i) => (
                        <div key={i.token} className="flex items-center justify-between border-b border-kapok py-2.5 text-sm">
                          <span className="text-[#4A463C]">
                            {new Date(i.createdAt).toLocaleDateString()} · {t("Utilisé {n} fois", { n: i.uses })}
                          </span>
                          <button disabled={busy} onClick={() => run(() => api("/api/invitations", "DELETE", { token: i.token }))} className="text-[13px] text-terre underline">
                            {t("Désactiver")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {tab === "membres" && (
            <section>
              <p className="mb-4 text-sm leading-relaxed text-[#4A463C] print:hidden">
                {t("Un QR code par personne, à imprimer et coller sous son portrait, sur un cadre ou une plaque. N’importe quel téléphone l’ouvre. Une fiche « famille » ne montre que le nom et les dates ; une fiche « publique » montre aussi son histoire.")}
              </p>
              {persons.length === 0 ? (
                <p className="rounded-[18px] border border-dashed border-or p-4 text-sm text-[#6B6455]">{t("Ajoutez d’abord des personnes dans l’arbre.")}</p>
              ) : (
                <>
                  {!embedded && !isNative && <GhostButton onClick={() => window.print()} className="mb-4 w-full print:hidden">{t("Imprimer toutes les étiquettes")}</GhostButton>}
                  <div className="grid grid-cols-2 gap-3 print:grid-cols-3">
                    {persons.map((p, i) => (
                      <motion.a
                        key={p.id}
                        href={`/membre/${p.id}`}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 12) * 0.05 }}
                        className="flex flex-col items-center rounded-[16px] border border-or-pale bg-white p-3 text-center shadow-doux print:break-inside-avoid print:shadow-none"
                      >
                        <QrBox svg={p.svg} size={120} />
                        <span className="mt-2 line-clamp-2 font-serif text-[15px] leading-tight text-nuit">{p.name}</span>
                        <span className="mt-0.5 text-[10px] tracking-[2px] text-or-fonce">
                          {p.code}
                          {!p.isPublic && ` · ${t("famille")}`}
                        </span>
                      </motion.a>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

function BigQr({ svg, title, sub }: { svg: string; title: string; sub: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }} className="relative mx-auto flex max-w-[320px] flex-col items-center overflow-hidden rounded-[24px] bg-nuit px-6 pb-6 pt-5 text-center text-coton shadow-doux print:bg-white print:text-nuit">
      <p className="font-serif text-[11px] tracking-[4px] text-or">NOS RACINES</p>
      <div className="mt-4 rounded-[18px] bg-coton p-3">
        <QrBox svg={svg} size={220} />
      </div>
      <p className="mt-4 font-serif text-xl">{title}</p>
      <p className="font-main text-lg text-or-pale print:text-or-fonce">{sub}</p>
    </motion.div>
  );
}

function LinkRow({ link, copied, onCopy, onShare }: { link: string; copied: boolean; onCopy: () => void; onShare: () => void }) {
  const t = useT();
  return (
    <div className="mt-4 flex items-center gap-2 rounded-[14px] border border-or-pale bg-white/70 p-2 pl-3.5 print:hidden">
      <span className="min-w-0 flex-1 truncate text-xs text-[#6B6455]">{link.replace(/^https?:\/\//, "")}</span>
      <button onClick={onCopy} className="rounded-full px-3 py-2 text-xs text-or-fonce">{copied ? t("Copié") : t("Copier")}</button>
      <button onClick={onShare} className="rounded-full bg-foret px-3.5 py-2 text-xs text-coton">{t("Partager")}</button>
    </div>
  );
}
