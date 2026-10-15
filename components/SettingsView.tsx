"use client";

import { linkSuffix } from "@/lib/local/sync";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, mediaUrl, uploadPhoto } from "@/lib/client";
import { exportFamily } from "@/lib/local/backup";
import { APK_URL, APP_VERSION, isNative, isPwa, openExternal, WEB_APP_URL } from "@/lib/native";
import { checkPwaUpdate } from "@/lib/pwa";
import { currentVersion } from "@/lib/native/updates";
import { lookForUpdate } from "./UpdateHost";
import { joinCode } from "@/lib/share-code";
import { cloudAvailable, enableSharing, getLink, getSyncStatus, leaveSharing, myRecoveryCode, subscribeSync, syncNow } from "@/lib/local/sync";
import { backupPath, fileBackupAvailable, getMode, getSaveState, lastSaved, saveNow, setMode, subscribeSave, type SaveMode } from "@/lib/local/autosave";
import { useSyncExternalStore } from "react";
import QRCode from "qrcode";
import { PhotoPicker } from "./forms/PhotoPicker";
import { DEFAULT_FACE } from "./AncestorFace";
import { LANGS } from "@/lib/i18n/core";
import { useLang, useT } from "@/lib/i18n/client";
import { askConfirm } from "@/components/Confirm";
import { sound } from "@/lib/sound";
import type { Lang, Role, Visibility } from "@/lib/types";
import { Card, ErrorNote, Field, GhostButton, PageHeader, PrimaryButton, RoleBadge, Select, Toggle } from "./ui";
import { CloudAccountCard, CloudHistoryCard, CloudMembersCard } from "./account/CloudSettings";

export interface SettingsData {
  isAdmin: boolean;
  canEdit?: boolean;
  role?: Role | null;
  meId: string;
  family: { name: string; village: string; motto: string; since?: number; introPhotoId?: string; introCaption?: string };
  covers: string[];
  candidates: string[];
  users: { id: string; name: string; role: Role; personName?: string; isOwner: boolean; isCreator: boolean; code?: string; connected: boolean }[];
  isOwner: boolean;
  isCreator: boolean;
  persons: { id: string; name: string }[];
  maxAdmins: number;
  settings: { onlineFeatures: boolean; defaultVisibility: Visibility; language: Lang; keyHint: string; envKey: boolean };
  translated: { bci: number; dyu: number; total: number };
  about: { persons: number; stories: number; memories: number; media: number; mediaMb: number; dataDir: string };
  activeInvites: number;
}

export function SettingsView({ d }: { d: SettingsData }) {
  const t = useT();
  // Famille en ligne : comptes personnels, membres et rôles, historique.
  const online = !!getLink();
  const SECTIONS = [
    ...(online ? [{ id: "compte", label: t("Mon compte") }, { id: "membres", label: t("Membres") }, ...(d.isAdmin ? [{ id: "inviter", label: t("Inviter") }] : []), ...(d.canEdit ? [{ id: "historique", label: t("Historique") }] : [])] : []),
    ...(d.isAdmin ? [{ id: "famille", label: t("Famille") }, { id: "couverture", label: t("Photos de couverture") }, { id: "generique", label: t("Générique") }] : []),
    { id: "langue", label: t("Langue") },
    { id: "son", label: t("Son") },
    { id: "internet", label: t("Internet") },
    ...(online ? [] : [{ id: "partage", label: t("Partage") }, { id: "comptes", label: t("Administrateurs") }]),
    { id: "sauvegarde", label: t("Sauvegarde") },
    ...(d.isAdmin ? [{ id: "confidentialite", label: t("Confidentialité") }] : []),
    { id: "apropos", label: t("À propos") },
  ];
  return (
    <main className="min-h-dvh bg-coton pb-20">
      <PageHeader title={t("Paramètres")} kicker={d.family.name} back="/accueil" />
      <nav className="nr-no-scrollbar sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-or/20 bg-coton/90 px-5 py-2.5 backdrop-blur-xl">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" })} className="shrink-0 rounded-full border border-or-pale bg-white/60 px-3 py-1.5 text-[12px] text-foret">
            {s.label}
          </button>
        ))}
      </nav>
      <div className="space-y-4 px-5 pt-4">
        {!d.isAdmin && (
          <p className="rounded-[16px] bg-kapok px-4 py-3 text-[13px] leading-relaxed text-foret">
            {d.canEdit
              ? t("Vous êtes éditeur : vous modifiez l’arbre, les récits et les souvenirs. Les rôles et les invitations restent aux administrateurs.")
              : t("Vous êtes lecteur : vous voyez tout, allumez des bougies, laissez des mots et complétez votre fiche une fois. Les administrateurs et les éditeurs modifient l’arbre.")}
          </p>
        )}
        {online && <CloudAccountCard />}
        {online && <CloudMembersCard persons={d.persons} />}
        {online && d.canEdit && <CloudHistoryCard />}
        {d.isAdmin && <FamilySection d={d} />}
        {d.isAdmin && <CoverSection d={d} />}
        {d.isAdmin && <IntroSection d={d} />}
        <LanguageSection d={d} />
        <SoundSection />
        <InternetSection d={d} />
        {!online && <SharingSection d={d} />}
        {!online && <AccountsSection d={d} />}
        {d.isAdmin && <PrivacySection d={d} />}
        <BackupSection d={d} />
        <AboutSection d={d} />
      </div>
    </main>
  );
}

function useSaver() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const run = async (fn: () => Promise<unknown>, refresh = true) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await fn();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (refresh) router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, saved, run, setError };
}

function Saved({ on }: { on: boolean }) {
  const t = useT();
  return (
    <AnimatePresence>
      {on && (
        <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13px] text-foret">
          {t("Enregistré")}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// ─── Famille ─────────────────────────────────────────────────────
function FamilySection({ d }: { d: SettingsData }) {
  const t = useT();
  const [f, setF] = useState({ name: d.family.name, village: d.family.village, motto: d.family.motto, since: d.family.since ? String(d.family.since) : "" });
  const { busy, error, saved, run } = useSaver();
  return (
    <div id="famille" className="scroll-mt-16">
      <Card title={t("La famille")} hint={t("Le nom, le village d’origine et la devise apparaissent sur l’accueil et sur les QR codes.")}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => api("/api/famille", "PATCH", { ...f, since: f.since || null }));
          }}
        >
          <Field label={t("Nom de la famille")} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={80} />
          <Field label={t("Village d’origine")} value={f.village} onChange={(e) => setF({ ...f, village: e.target.value })} maxLength={80} />
          <Field label={t("Devise ou proverbe de la famille")} value={f.motto} onChange={(e) => setF({ ...f, motto: e.target.value })} maxLength={140} />
          <Field label={t("Racines connues depuis (année)")} inputMode="numeric" value={f.since} onChange={(e) => setF({ ...f, since: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
          <ErrorNote message={error} />
          <div className="flex items-center gap-3">
            <PrimaryButton type="submit" loading={busy} className="flex-1">{t("Enregistrer")}</PrimaryButton>
            <Saved on={saved} />
          </div>
        </form>
      </Card>
    </div>
  );
}

// ─── Photos de couverture ────────────────────────────────────────
function CoverSection({ d }: { d: SettingsData }) {
  const t = useT();
  const [covers, setCovers] = useState(d.covers);
  const [uploading, setUploading] = useState(0);
  const { busy, error, run, setError } = useSaver();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setCovers(d.covers), [d.covers]);

  const save = (next: string[]) => {
    setCovers(next);
    return run(() => api("/api/famille", "PATCH", { covers: next }));
  };
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const ids: string[] = [];
    setUploading(files.length);
    for (const file of Array.from(files).slice(0, 10)) {
      try {
        ids.push((await uploadPhoto(file, true)).id);
      } catch (e) {
        setError((e as Error).message);
      }
      setUploading((n) => n - 1);
    }
    if (ids.length) {
      sound.play("chime");
      await save([...covers, ...ids].slice(0, 20));
    }
    if (input.current) input.current.value = "";
  };

  return (
    <div id="couverture" className="scroll-mt-16">
      <Card title={t("Photos de couverture")} hint={t("Elles défilent lentement en fond de l’accueil. Glissez pour changer l’ordre. 20 photos au maximum.")}>
        {covers.length > 0 && (
          <Reorder.Group axis="y" values={covers} onReorder={setCovers} className="mb-3 space-y-2">
            {covers.map((id, i) => (
              <Reorder.Item key={id} value={id} onDragEnd={() => void save(covers)} className="flex cursor-grab items-center gap-3 rounded-[14px] border border-or-pale bg-coton p-2 active:cursor-grabbing">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(id)} alt="" className="h-14 w-20 rounded-[10px] object-cover [filter:sepia(.3)]" draggable={false} />
                <span className="flex-1 text-[13px] text-[#4A463C]">{t("Photo {n}", { n: i + 1 })}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A917F" strokeWidth="1.8" aria-hidden><path d="M8 6h8M8 12h8M8 18h8" /></svg>
                <button disabled={busy} onClick={() => void save(covers.filter((x) => x !== id))} aria-label={t("Retirer")} className="flex h-9 w-9 items-center justify-center rounded-full text-[#9A917F]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
        <GhostButton className="w-full" disabled={uploading > 0} onClick={() => input.current?.click()}>
          {uploading > 0 ? t("Envoi… ({n} restante(s))", { n: uploading }) : t("Ajouter des photos de famille")}
        </GhostButton>
        {d.candidates.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-[12px] text-[#6B6455]">{t("Ou choisissez parmi les photos déjà ajoutées :")}</p>
            <div className="nr-no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {d.candidates.map((id) => (
                <button key={id} disabled={busy} onClick={() => void save([...covers, id].slice(0, 20))} className="relative shrink-0" aria-label={t("Ajouter au diaporama")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(id)} alt="" loading="lazy" className="h-16 w-16 rounded-[12px] object-cover" />
                  <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-or text-[13px] font-bold text-nuit">+</span>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      </Card>
    </div>
  );
}

// ─── Générique d'ouverture ───────────────────────────────────────
function IntroSection({ d }: { d: SettingsData }) {
  const t = useT();
  const [caption, setCaption] = useState(d.family.introCaption ?? "");
  const { busy, error, saved, run } = useSaver();
  return (
    <div id="generique" className="scroll-mt-16">
      <Card title={t("Générique d’ouverture")} hint={t("Le visage d’un ancêtre honoré apparaît doucement, fondu dans la lumière, à l’ouverture de l’application et en haut de l’accueil.")}>
        {!d.family.introPhotoId && !isPwa && (
          <div className="mb-3 flex items-center gap-3 rounded-[14px] bg-kapok/60 p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={DEFAULT_FACE} alt="" className="h-14 w-14 rounded-full object-cover [filter:grayscale(1)_sepia(.35)]" />
            <p className="text-[13px] leading-snug text-foret">{t("Visage actuel : celui de votre père. Choisissez une autre photo pour le remplacer.")}</p>
          </div>
        )}
        <PhotoPicker value={d.family.introPhotoId} onChange={(id) => void run(() => api("/api/famille", "PATCH", { introPhotoId: id ?? null }))} isPublic label={t("Choisir le visage")} />
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => api("/api/famille", "PATCH", { introCaption: caption }));
          }}
        >
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={80} placeholder={t("Ex. En hommage à notre père")} className="min-w-0 flex-1 rounded-[14px] border border-or-pale bg-coton px-3 py-2.5 text-[14px] outline-none focus:border-or" />
          <button type="submit" disabled={busy} className="rounded-full bg-foret px-4 text-[13px] text-coton">{t("Enregistrer")}</button>
        </form>
        <div className="mt-3 flex items-center gap-3">
          <GhostButton type="button" onClick={() => window.dispatchEvent(new Event("nr-intro"))} className="flex-1">{t("Revoir le générique")}</GhostButton>
          <Saved on={saved} />
        </div>
        <ErrorNote message={error} />
      </Card>
    </div>
  );
}

// ─── Langue ──────────────────────────────────────────────────────
function LanguageSection({ d }: { d: SettingsData }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [busy, setBusy] = useState<Lang | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { run } = useSaver();
  const choose = async (code: Lang) => {
    setBusy(code);
    setNote(null);
    try {
      const r = await api<{ status: string }>("/api/langue", "POST", { lang: code });
      if (r.status === "offline") setNote(t("Connexion Internet nécessaire la première fois pour traduire l’application dans cette langue. Le français s’affiche en attendant."));
      if (r.status === "error") setNote(t("La traduction a échoué. Réessayez plus tard."));
      if (r.status === "translated") setNote(t("Traduction terminée : cette langue fonctionne maintenant sans Internet."));
      router.refresh();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const pct = (n: number) => Math.min(100, Math.round((n / Math.max(1, d.translated.total)) * 100));
  return (
    <div id="langue" className="scroll-mt-16">
      <Card title={t("Langue de l’application")} hint={t("Ce choix concerne ce téléphone. Le baoulé et le dioula sont traduits automatiquement par Google la première fois (Internet nécessaire), puis gardés pour fonctionner hors connexion.")}>
        <div className="grid grid-cols-2 gap-2">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => void choose(l.code)}
              disabled={busy !== null}
              aria-pressed={lang === l.code}
              className={`relative rounded-[14px] border px-3 py-3 text-left ${lang === l.code ? "border-foret bg-foret text-coton" : "border-or-pale bg-coton text-nuit"}`}
            >
              <span className="block font-serif text-[17px]">{l.native}</span>
              <span className={`block text-[11px] ${lang === l.code ? "text-or-pale" : "text-[#6B6455]"}`}>
                {busy === l.code
                  ? t("Traduction en cours…")
                  : l.code === "bci" || l.code === "dyu"
                    ? t("{p} % traduit", { p: pct(d.translated[l.code]) })
                    : t(l.label)}
              </span>
            </button>
          ))}
        </div>
        {busy && (busy === "bci" || busy === "dyu") && <p className="mt-2 text-xs text-[#6B6455]">{t("Cela peut prendre une minute la première fois.")}</p>}
        {note && <p className="mt-3 rounded-[12px] bg-kapok px-3 py-2 text-[13px] leading-snug text-foret">{note}</p>}
        {d.isAdmin && (
          <div className="mt-4">
            <Select label={t("Langue par défaut pour les nouveaux appareils")} value={d.settings.language} onChange={(e) => void run(() => api("/api/parametres", "PATCH", { language: e.target.value }))}>
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>{l.native}</option>
              ))}
            </Select>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Son ─────────────────────────────────────────────────────────
function SoundSection() {
  const t = useT();
  const [on, setOn] = useState(true);
  const [level, setLevel] = useState(1);
  const [fx, setFx] = useState(true);
  useEffect(() => {
    setOn(sound.enabled);
    setLevel(sound.ambienceLevel);
    setFx(sound.effects);
    const off = sound.onChange(setOn);
    return () => {
      off();
    };
  }, []);
  return (
    <div id="son" className="scroll-mt-16">
      <Card title={t("Son")} hint={t("Réglages propres à ce téléphone.")}>
        <Toggle label={t("Ambiance sonore")} hint={t("Vent dans les feuilles et chants d’oiseaux")} checked={on} onChange={(v) => sound.setEnabled(v)} />
        <label className={`block py-2 ${on ? "" : "opacity-50"}`}>
          <span className="mb-1 flex justify-between text-[15px] text-ebene">
            {t("Volume de l’ambiance")}
            <span className="text-[13px] text-[#6B6455]">{Math.round(level * 100)} %</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            disabled={!on}
            value={Math.round(level * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setLevel(v);
              sound.setAmbienceLevel(v);
            }}
            className="w-full accent-[#C8A15A]"
          />
        </label>
        <Toggle
          label={t("Petits sons des boutons")}
          hint={t("Froissement de feuille, carillon, souffle entre les pages")}
          checked={fx}
          disabled={!on}
          onChange={(v) => {
            setFx(v);
            sound.setEffects(v);
            if (v) sound.play("chime");
          }}
        />
      </Card>
    </div>
  );
}

// ─── Internet ────────────────────────────────────────────────────
function InternetSection({ d }: { d: SettingsData }) {
  const t = useT();
  const [st, setSt] = useState<{ online: boolean; translate: boolean } | null>(null);
  const [key, setKey] = useState("");
  const { busy, error, saved, run } = useSaver();
  const check = () => {
    setSt(null);
    api<{ online: boolean; translate: boolean }>("/api/statut", "GET")
      .then(setSt)
      .catch(() => setSt({ online: false, translate: false }));
  };
  useEffect(check, [d.settings.onlineFeatures]);
  return (
    <div id="internet" className="scroll-mt-16">
      <Card title={t("Connexion Internet")} hint={t("L’application fonctionne sans Internet : l’arbre, les fiches, les voix et les photos restent dans ce téléphone. Internet ne sert qu’aux tâches compliquées : traduire l’application et les textes en baoulé ou en dioula.")}>
        <div className="mb-2 flex items-center gap-2.5 rounded-[14px] bg-kapok/60 px-3 py-2.5 text-[13px]">
          <motion.span
            className={`h-2.5 w-2.5 rounded-full ${st === null ? "bg-[#C9BFA9]" : st.online ? "bg-[#4E8B5A]" : "bg-terre"}`}
            animate={st === null ? { opacity: [0.3, 1, 0.3] } : { opacity: 1 }}
            transition={{ duration: 1.2, repeat: st === null ? Infinity : 0 }}
          />
          <span className="flex-1 text-foret">
            {st === null ? t("Vérification…") : !d.settings.onlineFeatures ? t("Fonctions en ligne désactivées") : st.online ? t("Internet disponible") : t("Pas d’Internet pour le moment")}
          </span>
          <button onClick={check} className="text-[12px] text-or-fonce underline">{t("Vérifier")}</button>
        </div>
        {d.isAdmin ? (
          <>
            <Toggle
              label={t("Autoriser les fonctions en ligne")}
              hint={t("Désactivez pour que l’application n’utilise jamais Internet.")}
              checked={d.settings.onlineFeatures}
              disabled={busy}
              onChange={(v) => void run(() => api("/api/parametres", "PATCH", { onlineFeatures: v }))}
            />
            <div className="mt-3 border-t border-kapok pt-3">
              <p className="text-[15px] text-ebene">{t("Clé Google Traduction (facultative)")}</p>
              <p className="mb-2 text-xs leading-snug text-[#6B6455]">
                {d.settings.keyHint || d.settings.envKey
                  ? t("Une clé est enregistrée : la traduction utilise le service officiel de Google.")
                  : t("Sans clé, l’application utilise la traduction gratuite de Google, parfois limitée. Une clé Google Cloud rend la traduction plus fiable.")}
              </p>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => api("/api/parametres", "PATCH", { translateKey: key })).then((ok) => ok && setKey(""));
                }}
              >
                <input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={d.settings.keyHint || "AIza…"}
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-[14px] border border-or-pale bg-coton px-3 py-2.5 text-[14px] outline-none focus:border-or"
                />
                <button type="submit" disabled={busy} className="rounded-full bg-foret px-4 text-[13px] text-coton disabled:opacity-50">{t("Enregistrer")}</button>
              </form>
              {d.settings.keyHint && (
                <button onClick={() => void run(() => api("/api/parametres", "PATCH", { translateKey: "" }))} className="mt-2 text-[12px] text-terre underline">
                  {t("Supprimer la clé")}
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <ErrorNote message={error} />
              <Saved on={saved} />
            </div>
          </>
        ) : (
          <p className="text-[13px] text-[#6B6455]">{t("Seul un administrateur peut changer ces réglages.")}</p>
        )}
      </Card>
    </div>
  );
}

// ─── Comptes et administrateurs ──────────────────────────────────
function AccountsSection({ d }: { d: SettingsData }) {
  const t = useT();
  const { busy, error, run } = useSaver();
  const admins = d.users.filter((u) => u.role === "admin").length;
  const [form, setForm] = useState<{ open: boolean; name: string; personId: string }>({ open: false, name: "", personId: "" });
  const [shown, setShown] = useState<string | null>(null);
  const create = () =>
    run(async () => {
      const r = await api<{ id: string; code: string }>("/api/comptes", "POST", { name: form.name, personId: form.personId || undefined });
      setForm({ open: false, name: "", personId: "" });
      setShown(r.id);
      sound.play("chime");
    });
  return (
    <div id="comptes" className="scroll-mt-16">
      <Card
        title={t("Comptes de la famille")}
        hint={t("Les membres voient tout sans rien modifier. Seul l’administrateur principal peut donner les droits d’administrateur ({n} sur {max}).", { n: admins, max: d.maxAdmins })}
      >
        <ul className="divide-y divide-kapok">
          {d.users.map((u) => (
            <li key={u.id} className="py-3">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-serif text-[15px] ${u.isOwner ? "bg-or text-nuit" : "bg-kapok text-foret"}`}>{u.name.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-ebene">
                    {u.name}
                    {u.id === d.meId && <span className="text-[#6B6455]"> · {t("vous")}</span>}
                  </span>
                  <span className="block truncate text-xs text-[#6B6455]">
                    {[u.personName && t("Dans l’arbre : {nom}", { nom: u.personName }), !u.connected && t("Pas encore connecté")].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {u.isCreator ? <span className="rounded-full bg-nuit px-2.5 py-1 text-[11px] font-semibold text-or">{t("Fondateur")}</span> : u.isOwner ? <span className="rounded-full border border-nuit px-2.5 py-1 text-[11px] font-semibold text-nuit">{t("Administrateur principal")}</span> : <RoleBadge admin={u.role === "admin"} role={u.role} />}
              </div>
              {(u.code || shown === u.id) && d.isAdmin && <AccessCode userId={u.id} code={u.code} name={u.name} open={shown === u.id} onToggle={() => setShown(shown === u.id ? null : u.id)} />}
              {d.isAdmin && !u.isOwner && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 pl-[52px] text-[12px]">
                  {d.isOwner &&
                    (u.role === "membre" ? (
                      <button disabled={busy || admins >= d.maxAdmins} onClick={() => void run(() => api(`/api/utilisateurs/${u.id}`, "PATCH", { role: "admin" }))} className="text-or-fonce underline disabled:no-underline disabled:opacity-40">
                        {t("Déléguer : nommer administrateur")}
                      </button>
                    ) : (
                      <button disabled={busy} onClick={() => void run(() => api(`/api/utilisateurs/${u.id}`, "PATCH", { role: "membre" }))} className="text-or-fonce underline">
                        {t("Retirer les droits (lecture seule)")}
                      </button>
                    ))}
                  {!u.code && shown !== u.id && u.role === "membre" && (
                    <button disabled={busy} onClick={() => void run(async () => { await api("/api/comptes", "POST", { userId: u.id }); setShown(u.id); })} className="text-or-fonce underline">
                      {t("Nouveau code d’accès")}
                    </button>
                  )}
                  {u.id !== d.meId && (d.isOwner || u.role === "membre") && (
                    <button disabled={busy} onClick={async () => (await askConfirm(t("Retirer {nom} de la famille ? Son téléphone n’aura plus accès.", { nom: u.name }))) && void run(() => api(`/api/utilisateurs/${u.id}`, "DELETE"))} className="text-terre underline">
                      {t("Retirer l’accès")}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {d.isOwner && admins >= d.maxAdmins && <p className="mt-1 text-xs text-[#6B6455]">{t("Maximum atteint : retirez les droits d’un administrateur pour en nommer un autre.")}</p>}
        <ErrorNote message={error} />
        {d.isAdmin && (
          <AnimatePresence initial={false} mode="wait">
            {form.open ? (
              <motion.form
                key="f"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void create();
                }}
                className="mt-3 space-y-3 rounded-[16px] bg-kapok/60 p-3"
              >
                <Field label={t("Prénom de la personne")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={60} autoFocus />
                <Select label={t("Sa fiche dans l’arbre (facultatif)")} value={form.personId} onChange={(e) => setForm({ ...form, personId: e.target.value })}>
                  <option value="">{t("— Aucun —")}</option>
                  {d.persons.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
                <p className="text-xs leading-snug text-[#6B6455]">{t("Le compte sera en lecture seule. Vous recevrez un code d’accès à lui donner.")}</p>
                <div className="flex gap-2">
                  <GhostButton type="button" onClick={() => setForm({ ...form, open: false })} className="flex-1">{t("Annuler")}</GhostButton>
                  <button type="submit" disabled={busy || !form.name.trim()} className="min-h-12 flex-1 rounded-full bg-foret text-sm font-semibold text-coton disabled:opacity-40">{t("Créer le compte")}</button>
                </div>
              </motion.form>
            ) : (
              <motion.div key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setForm({ ...form, open: true })} className="flex min-h-12 items-center justify-center rounded-full bg-foret px-3 text-[13px] font-semibold text-coton">
                  {t("+ Créer un compte")}
                </button>
                <Link href="/qr" className="flex min-h-12 items-center justify-center rounded-full border border-or px-3 text-center text-[13px] text-or-fonce">
                  {t("Invitation libre (QR)")}
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </Card>
    </div>
  );
}

/** Code d'accès d'un compte, avec son QR code, à montrer ou envoyer à la personne. */
function AccessCode({ userId, code, name, open, onToggle }: { userId: string; code?: string; name: string; open: boolean; onToggle: () => void }) {
  const t = useT();
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const pretty = code ? `${code.slice(0, 4)}-${code.slice(4)}` : "";
  useEffect(() => {
    if (!open || !code) return;
    const link = joinCode(code, linkSuffix());
    void QRCode.toString(link, { type: "svg", margin: 1, color: { dark: "#12261A", light: "#FFFFFF" } }).then(setSvg);
  }, [open, code]);
  void userId;
  if (!code) return null;
  return (
    <div className="mt-2 pl-[52px]">
      <button onClick={onToggle} className="flex items-center gap-2 rounded-[12px] border border-dashed border-or bg-or/10 px-3 py-1.5">
        <span className="text-[11px] text-or-fonce">{t("Code d’accès")}</span>
        <span className="font-serif text-[16px] tracking-[2px] text-nuit">{pretty}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-2 flex items-center gap-3 rounded-[14px] bg-white p-3">
              {svg && <div className="h-[96px] w-[96px] shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />}
              <div className="min-w-0 text-[12px] leading-snug text-[#4A463C]">
                {t("{nom} ouvre l’application, touche « Scanner » et vise ce QR code, ou tape ce code dans « Vous avez reçu un code d’accès ? ». Valable une fois.", { nom: name })}
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pretty);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {}
                  }}
                  className="mt-1.5 block text-or-fonce underline"
                >
                  {copied ? t("Copié") : t("Copier le code")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Confidentialité ─────────────────────────────────────────────
function PrivacySection({ d }: { d: SettingsData }) {
  const t = useT();
  const { run, saved } = useSaver();
  return (
    <div id="confidentialite" className="scroll-mt-16">
      <Card title={t("Confidentialité")} hint={t("Une fiche « publique » s’affiche à quiconque scanne son QR code (portrait, dates, citation). Une fiche « famille » ne montre que le nom aux inconnus.")}>
        <Select label={t("Visibilité des nouvelles fiches")} value={d.settings.defaultVisibility} onChange={(e) => void run(() => api("/api/parametres", "PATCH", { defaultVisibility: e.target.value }))}>
          <option value="famille">{t("Famille seulement")}</option>
          <option value="public">{t("Publique (QR code)")}</option>
        </Select>
        <Saved on={saved} />
      </Card>
    </div>
  );
}

// ─── Sauvegarde et réinitialisation ──────────────────────────────
function BackupSection({ d }: { d: SettingsData }) {
  const t = useT();
  const router = useRouter();
  const [confirmName, setConfirmName] = useState("");
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useSaver();
  return (
    <div id="sauvegarde" className="scroll-mt-16 space-y-4">
      <AutoBackupCard meId={d.meId} />
      {d.isAdmin && !getLink() && <Card title={t("Tout effacer")} className="border-terre/30">
        {!open ? (
          <button onClick={() => setOpen(true)} className="text-[13px] text-terre underline">{t("Réinitialiser l’application…")}</button>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api("/api/famille", "DELETE", { confirm: confirmName });
                router.replace("/");
              }, false);
            }}
          >
            <p className="text-[13px] leading-relaxed text-[#8A3A26]">{t("Toutes les fiches, voix, photos et comptes seront effacés définitivement. Tapez le nom de la famille pour confirmer :")}</p>
            <Field label={d.family.name} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
            <ErrorNote message={error} />
            <div className="flex gap-2">
              <GhostButton type="button" onClick={() => setOpen(false)} className="flex-1">{t("Annuler")}</GhostButton>
              <button type="submit" disabled={busy || confirmName.trim().toLowerCase() !== d.family.name.toLowerCase()} className="min-h-12 flex-1 rounded-full bg-terre text-sm font-semibold text-coton disabled:opacity-40">
                {t("Tout effacer")}
              </button>
            </div>
          </form>
        )}
      </Card>}
    </div>
  );
}

function AutoBackupCard({ meId }: { meId: string }) {
  const t = useT();
  const save = useSyncExternalStore(subscribeSave, getSaveState);
  const [mode, setM] = useState<SaveMode>(getMode());
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const linked = !!getLink();
  useEffect(() => {
    if (linked) void myRecoveryCode(meId).then(setCode).catch(() => setCode(null));
  }, [linked, meId]);
  const last = lastSaved();
  return (
    <>
      <Card title={t("Sauvegarde")} hint={isPwa ? t("Tout est enregistré dans cet iPhone. Gardez aussi une copie à l’abri : touchez « Enregistrer une copie », puis « Enregistrer dans Fichiers » (iCloud Drive). Sur un autre téléphone, on rouvre ce fichier et tout revient là où on s’était arrêté.") : t("Tout est enregistré dans ce téléphone, et aussi dans un fichier de sauvegarde qui reste même si l’application est effacée. Après une réinstallation, ou sur un autre téléphone, on rouvre ce fichier et tout revient là où on s’était arrêté.")}>
        {!isPwa && <Toggle
          label={t("Sauvegarde automatique")}
          hint={mode === "auto" ? t("Après chaque information ajoutée, le fichier est mis à jour tout seul.") : t("Après chaque information ajoutée, une petite notification vous propose de sauvegarder.")}
          checked={mode === "auto"}
          onChange={(v) => {
            const m: SaveMode = v ? "auto" : "manuel";
            setMode(m);
            setM(m);
          }}
        />}
        {isPwa ? (
          <p className="mt-1 text-[12px] leading-relaxed text-[#6B6455]">{last ? t("Dernière copie : {d}", { d: new Date(last).toLocaleString() }) : t("Pas encore de copie.")} {t("Tous les trois jours au plus, une petite notification vous le rappelle.")}</p>
        ) : fileBackupAvailable ? (
          <div className="mt-3 rounded-[14px] bg-kapok px-3 py-2.5 text-[12px] leading-relaxed text-foret">
            <p>
              {t("Fichier")} : <b>{backupPath()}</b>
            </p>
            <p>{last ? t("Dernière sauvegarde : {d}", { d: new Date(last).toLocaleString() }) : t("Pas encore de sauvegarde.")}</p>
          </div>
        ) : (
          <p className="mt-3 text-[12px] leading-relaxed text-[#6B6455]">{t("Dans cette version de démonstration, la sauvegarde se télécharge. Dans l’application Android, elle va toute seule dans Documents › NosRacines.")}</p>
        )}
        <ErrorNote message={err ?? save.error ?? null} />
        <div className="mt-3 flex gap-2">
          {fileBackupAvailable && (
            <GhostButton className="flex-1" disabled={save.busy} onClick={() => void saveNow()}>
              {save.busy ? t("Sauvegarde…") : t("Sauvegarder maintenant")}
            </GhostButton>
          )}
          <GhostButton
            className="flex-1"
            onClick={async () => {
              setErr(null);
              try {
                await exportFamily();
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
          >
            {fileBackupAvailable ? t("Envoyer une copie") : isPwa ? t("Enregistrer une copie") : t("Télécharger une sauvegarde")}
          </GhostButton>
        </div>
        <p className="mt-2 text-xs leading-snug text-[#6B6455]">{t("Le fichier contient toute la famille : fiches, liens, récits, photos et voix. Pour le rouvrir : premier écran › « Restaurer une sauvegarde ».")}</p>
      </Card>
      {linked && code && (
        <Card title={t("Votre code de reprise")} hint={t("Notez-le sur papier. Sur un nouveau téléphone ou après une réinstallation : premier écran › « Reprendre avec mon code de reprise ». La famille et votre compte reviennent, là où vous vous étiez arrêté.")}>
          <div className="flex items-center gap-3">
            <p className="flex-1 whitespace-nowrap rounded-[14px] border border-dashed border-or bg-or/10 px-2 py-3 text-center font-serif text-[16px] tracking-[1px] text-nuit">{code}</p>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {}
              }}
              className="text-[13px] text-or-fonce underline"
            >
              {copied ? t("Copié") : t("Copier")}
            </button>
          </div>
          <p className="mt-2 text-[12px] text-[#6B6455]">{t("Ce code est personnel : il ouvre votre compte. Ne le donnez à personne.")}</p>
        </Card>
      )}
    </>
  );
}

// ─── À propos ────────────────────────────────────────────────────
function AboutSection({ d }: { d: SettingsData }) {
  const t = useT();
  const [version, setVersion] = useState(APP_VERSION);
  const [check, setCheck] = useState<"" | "busy" | "none" | "found" | "error">("");
  const [apkQr, setApkQr] = useState("");
  const [iosQr, setIosQr] = useState("");
  const [os, setOs] = useState<"android" | "iphone">(isPwa ? "iphone" : "android");
  useEffect(() => {
    void currentVersion().then(setVersion);
    const qr = (u: string) => QRCode.toDataURL(u, { margin: 1, width: 360, color: { dark: "#12261A", light: "#FBF6EC" } });
    if (APK_URL) void qr(APK_URL).then(setApkQr);
    if (WEB_APP_URL) void qr(WEB_APP_URL).then(setIosQr);
  }, []);
  const install = os === "iphone" && iosQr ? { qr: iosQr, url: WEB_APP_URL } : apkQr ? { qr: apkQr, url: APK_URL } : iosQr ? { qr: iosQr, url: WEB_APP_URL } : null;
  return (
    <div id="apropos" className="scroll-mt-16">
      <Card title={t("À propos")}>
        <dl className="grid grid-cols-2 gap-y-1.5 text-[13px]">
          <dt className="text-[#6B6455]">{t("Personnes")}</dt>
          <dd className="text-right text-ebene">{d.about.persons}</dd>
          <dt className="text-[#6B6455]">{t("Récits")}</dt>
          <dd className="text-right text-ebene">{d.about.stories}</dd>
          <dt className="text-[#6B6455]">{t("Souvenirs")}</dt>
          <dd className="text-right text-ebene">{d.about.memories}</dd>
          <dt className="text-[#6B6455]">{t("Photos et voix")}</dt>
          <dd className="text-right text-ebene">{d.about.media} · {d.about.mediaMb} Mo</dd>
          <dt className="text-[#6B6455]">{t("Version")}</dt>
          <dd className="text-right text-ebene">{version}</dd>
        </dl>
        {(isNative || isPwa) && (
          <div className="mt-4">
            <GhostButton
              className="w-full"
              onClick={async () => {
                setCheck("busy");
                if (isPwa) return setCheck(await checkPwaUpdate());
                const r = await lookForUpdate();
                setCheck(r.kind === "none" ? "none" : r.kind === "error" ? "error" : "found");
              }}
            >
              {check === "busy" ? t("Recherche…") : t("Vérifier les mises à jour")}
            </GhostButton>
            {check === "none" && <p className="mt-2 text-center text-[12px] text-foret">{t("Vous avez la dernière version.")}</p>}
            {check === "found" && <p className="mt-2 text-center text-[12px] text-foret">{t("Une nouvelle version est prête : voyez le bandeau en haut de l’écran.")}</p>}
            {check === "error" && <p className="mt-2 text-center text-[12px] text-terre">{t("Pas de connexion pour le moment. Réessayez plus tard.")}</p>}
            <p className="mt-2 text-[11px] leading-relaxed text-[#6B6455]">{t("Les mises à jour sont publiées uniquement par le créateur de l’application. Elles ne touchent jamais à votre famille, vos photos ni vos voix.")}</p>
          </div>
        )}
        {install && (
          <div className="mt-5 rounded-[18px] bg-kapok p-4 text-center">
            <p className="font-serif text-[18px] text-nuit">{t("Installer l’application chez un proche")}</p>
            {apkQr && iosQr && (
              <div className="mx-auto mt-3 flex w-fit rounded-full bg-coton p-1 text-[13px]">
                {(["android", "iphone"] as const).map((k) => (
                  <button key={k} onClick={() => setOs(k)} className={`min-h-9 rounded-full px-4 ${os === k ? "bg-nuit text-coton" : "text-[#3E3A32]"}`}>
                    {k === "android" ? "Android" : "iPhone"}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-[12px] leading-relaxed text-[#3E3A32]">
              {install.url === WEB_APP_URL
                ? t("Il scanne ce code avec l’appareil photo de son iPhone et ouvre le lien dans Safari. Puis il touche le bouton Partager, et « Sur l’écran d’accueil ».")
                : t("Il scanne ce code avec l’appareil photo de son téléphone Android, télécharge l’application et l’installe.")}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={install.qr} alt="" className="mx-auto mt-3 h-40 w-40 rounded-[12px]" />
            <button onClick={() => openExternal(install.url)} className="mt-2 text-[12px] text-foret underline">{install.url === WEB_APP_URL ? t("Ouvrir le lien") : t("Ouvrir le lien de téléchargement")}</button>
          </div>
        )}
        {!d.isCreator && <CreatorUnlock />}
        <p className="mt-4 text-[12px] leading-relaxed text-[#6B6455]">
          {t("NOS RACINES, version {v}. Gratuit. Vos données restent dans votre famille : rien n’est envoyé sur Internet, sauf les textes à traduire. L’intelligence artificielle ne recrée jamais la voix d’une personne.", { v: version })}
        </p>
      </Card>
    </div>
  );
}

// ─── Partage en direct entre les téléphones ─────────────────────────
function SharingSection({ d }: { d: SettingsData }) {
  const t = useT();
  const st = useSyncExternalStore(subscribeSync, getSyncStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linked = !!getLink();
  const ago = st.last ? Math.max(0, Math.round((Date.now() - st.last) / 60000)) : null;
  return (
    <div id="partage" className="scroll-mt-16">
      <Card title={t("Partage en direct")} hint={t("Tous les téléphones de la famille voient la même chose : l’arbre, les photos, les voix, les récits, les bougies et les mots. Chaque téléphone garde aussi tout, pour marcher sans Internet.")}>
        {!cloudAvailable ? (
          <p className="text-[13px] text-[#6B6455]">{t("Le partage en direct arrive avec la prochaine mise à jour de l’application.")}</p>
        ) : linked ? (
          <>
            <div className="flex items-center gap-3 rounded-[14px] bg-kapok px-3 py-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${st.error ? "bg-terre" : st.busy ? "animate-pulse bg-or" : "bg-[#3C8D5A]"}`} />
              <p className="flex-1 text-[13px] text-foret">
                {st.busy
                  ? st.sending
                    ? t("Envoi des photos et des voix… ({n})", { n: st.sending })
                    : t("Synchronisation…")
                  : st.error === "reseau"
                    ? t("Pas de connexion : tout est gardé ici et partira dès le retour d’Internet.")
                    : st.error === "refus"
                      ? t("Accès refusé : demandez un nouveau QR code « Rejoindre » à l’administrateur principal.")
                      : ago === null
                        ? t("Activé")
                        : ago < 1
                          ? t("À jour")
                          : t("À jour il y a {n} min", { n: ago })}
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <GhostButton className="flex-1" disabled={st.busy} onClick={() => void syncNow()}>
                {t("Synchroniser")}
              </GhostButton>
              <GhostButton
                className="flex-1"
                onClick={async () => {
                  if (await askConfirm(t("Arrêter le partage sur ce téléphone ? La famille reste partagée sur les autres téléphones ; celui-ci ne recevra plus les nouveautés."))) leaveSharing();
                }}
              >
                {t("Arrêter ici")}
              </GhostButton>
            </div>
            {d.isAdmin && <p className="mt-3 text-[12px] leading-relaxed text-[#6B6455]">{t("Pour ajouter un téléphone : QR codes › Inviter. Le proche installe l’application, touche « Scanner » et reçoit toute la famille.")}</p>}
          </>
        ) : d.isOwner ? (
          <>
            <p className="text-[13px] leading-relaxed text-[#4A463C]">{t("Activez le partage : votre famille est envoyée dans un espace en ligne protégé par une clé secrète, que seul le QR code « Rejoindre » transmet.")}</p>
            <ErrorNote message={error} />
            <PrimaryButton
              className="mt-3"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await enableSharing();
                  sound.play("success");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("Activer le partage en direct")}
            </PrimaryButton>
          </>
        ) : (
          <p className="text-[13px] text-[#6B6455]">{t("L’administrateur principal de la famille peut activer le partage. Vous recevrez ensuite tout en scannant son QR code « Rejoindre ».")}</p>
        )}
      </Card>
    </div>
  );
}

/** Le créateur de l'application se fait reconnaître (titre « Fondateur », espace du fondateur). */
function CreatorUnlock() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mt-4 text-[11px] text-[#9A917F] underline">
        {t("Créateur de l’application ?")}
      </button>
    );
  return (
    <form
      className="mt-4 rounded-[14px] bg-kapok p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await api("/api/createur", "POST", { code });
          sound.play("success");
          router.refresh();
        } catch (x) {
          setErr((x as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-[12px] text-foret">{t("Entrez votre code créateur.")}</p>
      <div className="mt-2 flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" className="min-w-0 flex-1 rounded-[12px] border border-or-pale bg-coton px-3 py-2 text-center font-serif tracking-[3px] text-nuit outline-none focus:border-or" />
        <button disabled={busy || code.trim().length < 6} className="rounded-full bg-foret px-4 text-[13px] font-semibold text-coton disabled:opacity-40">
          {busy ? "…" : t("Valider")}
        </button>
      </div>
      <ErrorNote message={err} />
    </form>
  );
}
