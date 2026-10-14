"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Dust, Grain, Vignette } from "@/components/ambiance";
import { Chest } from "@/components/CapsuleView";
import { useLang, useT } from "@/lib/i18n/client";
import { addToCapsule, isLegacy, itemFile, localCode, normCode, openCapsule, releasedCode, removeFromCapsule, type NewItem, type Opened } from "@/lib/local/coffre";
import { extFor, exportBlob } from "@/lib/local/exporter";
import { sound } from "@/lib/sound";
import type { Capsule, CapsuleItem, User } from "@/lib/types";
import { askConfirm } from "../Confirm";
import { BackButton } from "../ui";
import { ItemsEditor } from "./ItemsEditor";
import { CoffreKey, Countdown, formatDate, ItemIcon } from "./parts";

export interface DetailData {
  capsule: Capsule;
  me: User;
  author: boolean;
  recipient: boolean;
  due: boolean;
  openDate: string;
  toLabel: string;
  justSealed: boolean;
}

export function CoffreDetail({ d }: { d: DetailData }) {
  const t = useT();
  const lang = useLang();
  const c = d.capsule;
  const [opened, setOpened] = useState<Opened | null>(null);
  const [code, setCode] = useState("");
  const [keyCode, setKeyCode] = useState<string | null>(d.author ? localCode(c.id) ?? null : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState<NewItem[] | null>(null);

  // Le jour venu, la clé (et son code) arrive pour le bénéficiaire.
  useEffect(() => {
    if (!d.author && d.recipient && d.due) {
      void releasedCode(c).then((x) => {
        setKeyCode(x);
        if (x) setCode(x);
      });
    }
  }, [d.author, d.recipient, d.due, c]);

  async function open(withCode = code) {
    setBusy(true);
    setErr(null);
    try {
      const o = await openCapsule(c.id, withCode, d.me);
      setOpened(o);
      sound.play("chime");
    } catch (e) {
      setErr((e as Error).message);
      sound.play("tap");
    } finally {
      setBusy(false);
    }
  }

  // Ancienne capsule ou coffre arrivé à date sur le téléphone de son auteur : on ouvre tout de suite.
  useEffect(() => {
    if (isLegacy(c) && (d.due || d.author)) void open("");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = !opened && !d.author && !(d.recipient && d.due) && !(isLegacy(c) && d.due);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-nuit px-5 pb-12 pt-[52px] text-coton">
      <Vignette glow="rgba(200,161,90,0.22)" at="50% 26%" />
      <Dust />
      <Grain opacity={0.08} />
      <header className="relative flex items-center gap-3">
        <BackButton href="/capsule" dark />
        <div className="min-w-0">
          <p className="font-main text-lg leading-none text-or">{d.author ? t("votre coffre") : t("un coffre de {nom}", { nom: c.byName })}</p>
          <h1 className="truncate font-serif text-[24px] font-light">{c.title || t("Coffre du futur")}</h1>
        </div>
      </header>

      {!opened && (
        <div className="relative mt-2 flex h-[250px] items-center justify-center">
          <Chest sealed={!(d.due && (d.recipient || d.author))} />
        </div>
      )}

      {d.justSealed && !opened && (
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3 }} className="relative text-center font-main text-2xl text-or">
          {t("Scellé avec amour")}
        </motion.p>
      )}

      <div className="relative mt-2 text-center">
        <p className="text-[13px] text-or-pale">
          {t("Pour {qui}", { qui: d.toLabel })} · {d.due ? t("ouvert depuis le {date}", { date: formatDate(d.openDate, lang) }) : t("s’ouvre le {date}", { date: formatDate(d.openDate, lang) })}
        </p>
        {!d.due && (
          <div className="mt-3">
            <Countdown date={d.openDate} />
          </div>
        )}
      </div>

      {locked && (
        <p className="relative mx-auto mt-6 max-w-[320px] text-center text-[14px] leading-relaxed text-coton/80">
          {d.recipient ? t("Ce coffre vous est destiné. Le jour venu, vous recevrez sa clé et vous pourrez l’ouvrir.") : t("Ce coffre est scellé. Seules les personnes à qui il est destiné pourront l’ouvrir, le jour venu.")}
        </p>
      )}

      {/* La clé : celle de l'auteur (dans son profil), ou celle reçue par le bénéficiaire le jour venu. */}
      {!opened && !locked && !isLegacy(c) && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative mt-6 rounded-[24px] border border-or/40 bg-coton/5 p-4">
          <div className="flex justify-center">
            <motion.div animate={{ rotate: [-2, 2, -2] }} transition={{ duration: 5, repeat: Infinity }}>
              <CoffreKey code={keyCode ?? undefined} size={70} />
            </motion.div>
          </div>
          <p className="mt-3 text-center text-[13px] text-or-pale">
            {d.author
              ? keyCode
                ? t("Votre clé. Touchez « Ouvrir » pour voir le coffre et y ajouter des choses.")
                : t("Tapez le code de votre clé pour ouvrir le coffre.")
              : keyCode
                ? t("Voici la clé de {nom}. Son code : {code}.", { nom: c.byName, code: keyCode })
                : t("Tapez le code de la clé que vous avez reçue.")}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={code || (d.author ? keyCode ?? "" : "")}
              onChange={(e) => setCode(normCode(e.target.value))}
              maxLength={4}
              autoCapitalize="characters"
              autoComplete="off"
              aria-label={t("Code de la clé")}
              placeholder="••••"
              className="min-h-12 w-[7.5rem] rounded-[14px] border border-or-pale/30 bg-coton/10 text-center font-serif text-[22px] tracking-[5px] text-coton outline-none focus:border-or"
            />
            <button disabled={busy || !(code || keyCode)} onClick={() => void open(code || keyCode || "")} className="min-h-12 flex-1 rounded-full bg-or text-[15px] font-semibold text-nuit disabled:opacity-40">
              {busy ? "…" : t("Ouvrir le coffre")}
            </button>
          </div>
          {err && <p className="mt-2 text-center text-[13px] text-[#F3C9B8]">{err}</p>}
        </motion.div>
      )}

      <AnimatePresence>
        {opened && (
          <motion.section key="in" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative mt-6 space-y-3">
            <p className="text-center font-main text-[22px] text-or">{d.author ? t("Dans votre coffre") : t("De la part de {nom}", { nom: c.byName })}</p>
            {opened.items.length === 0 && <p className="text-center text-[13px] text-or-pale">{t("Le coffre est vide.")}</p>}
            {opened.items.map((it) => (
              <ItemCard
                key={it.id}
                it={it}
                o={opened}
                canRemove={d.author && !d.due}
                onRemove={async () => {
                  if (await askConfirm(t("Retirer cet élément du coffre ?"))) setOpened(await removeFromCapsule(opened, d.me, it.id));
                }}
              />
            ))}
            {d.author && !d.due && (
              <div className="rounded-[20px] border border-or/30 p-4">
                {adding === null ? (
                  <button onClick={() => setAdding([])} className="min-h-12 w-full rounded-full border border-or text-[14px] text-or">
                    {t("+ Ajouter des choses dans le coffre")}
                  </button>
                ) : (
                  <>
                    <ItemsEditor items={adding} onChange={setAdding} />
                    <button
                      disabled={!adding.length || busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          setOpened(await addToCapsule(opened, d.me, adding));
                          setAdding(null);
                          sound.play("seal");
                        } catch (e) {
                          setErr((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="mt-3 min-h-12 w-full rounded-full bg-or text-[14px] font-semibold text-nuit disabled:opacity-40"
                    >
                      {busy ? "…" : t("Déposer et refermer")}
                    </button>
                  </>
                )}
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

function ItemCard({ it, o, canRemove, onRemove }: { it: CapsuleItem; o: Opened; canRemove: boolean; onRemove: () => void }) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    let u = "";
    void itemFile(o, it).then((b) => {
      if (!b) return;
      setBlob(b);
      setUrl((u = URL.createObjectURL(b)));
    });
    return () => void (u && URL.revokeObjectURL(u));
  }, [o, it]);
  const fileName = `${it.kind}-${o.capsule.byName}-${new Date(it.addedAt).toISOString().slice(0, 10)}.${extFor(it.mime)}`.replace(/\s+/g, "-");
  const exportBtn = (blob || it.kind === "lettre") && (
    <button
      onClick={() => void exportBlob(it.kind === "lettre" ? `lettre-${o.capsule.byName}.txt` : fileName, blob ?? new Blob([it.text ?? ""], { type: "text/plain" }))}
      className="rounded-full border border-[#8A6A2E]/50 px-3 py-1.5 text-[12px] text-[#6B5A30]"
    >
      {t("Enregistrer hors de l’application")}
    </button>
  );
  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[20px] bg-[#F3ECDD] text-[#2A2016]">
      {it.kind === "lettre" && <p className="whitespace-pre-line px-4 pt-4 font-main text-[21px] leading-snug">{it.text}</p>}
      {(it.kind === "photo" || (it.kind === "document" && !(it.mime ?? "").includes("pdf"))) && url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="max-h-[420px] w-full bg-black/5 object-contain" />
      )}
      {it.kind === "document" && (it.mime ?? "").includes("pdf") && (
        <div className="flex items-center gap-3 px-4 pt-4">
          <ItemIcon kind="document" size={30} color="#8A6A2E" />
          <span className="text-[14px]">{it.name || t("Document PDF")}</span>
        </div>
      )}
      {it.kind === "voix" && url && <audio controls src={url} className="mx-4 mt-4 w-[calc(100%-2rem)]" />}
      {it.kind === "video" && url && <video controls playsInline src={url} className="max-h-[420px] w-full bg-black" />}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[11px] text-[#6B5A30]">
        <span className="flex items-center gap-1.5">
          <ItemIcon kind={it.kind} size={14} color="#8A6A2E" />
          {new Date(it.addedAt).toLocaleDateString()}
        </span>
        <span className="flex gap-2">
          {canRemove && (
            <button onClick={onRemove} className="rounded-full border border-terre/40 px-3 py-1.5 text-[12px] text-terre">
              {t("Retirer")}
            </button>
          )}
          {exportBtn}
        </span>
      </div>
    </motion.article>
  );
}
