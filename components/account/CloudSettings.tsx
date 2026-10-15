"use client";

import QRCode from "qrcode";
import { useEffect, useState, useSyncExternalStore } from "react";
import { askConfirm } from "@/components/Confirm";
import { Card, ErrorNote, GhostButton, RoleBadge } from "@/components/ui";
import { changePassword, myEmail, myUid, rpc, signOut } from "@/lib/cloud";
import { useT } from "@/lib/i18n/client";
import { exportBlob } from "@/lib/local/exporter";
import {
  createInvitation,
  familyInfo,
  getMembers,
  getSyncStatus,
  history,
  leaveSharing,
  listInvitations,
  myMember,
  refreshMembers,
  removeMember,
  revokeInvitation,
  setMember,
  subscribeSync,
  syncNow,
  type AuditEntry,
  type CloudInvitation,
  type CloudMember,
} from "@/lib/local/sync";
import { joinCode } from "@/lib/share-code";

// Paramètres de la famille en ligne : mon compte, les membres et leurs rôles,
// les invitations, l'historique des modifications.

const ROLE_LABEL = { admin: "Administrateur", editeur: "Éditeur", lecteur: "Lecteur" } as const;
const sel = "min-h-10 rounded-full border border-or-pale bg-white px-3 text-[13px] text-foret";

// ─── Mon compte ───
export function CloudAccountCard() {
  const t = useT();
  const st = useSyncExternalStore(subscribeSync, getSyncStatus);
  const me = myMember();
  const [name, setName] = useState(me?.name ?? "");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ago = st.last ? Math.max(0, Math.round((Date.now() - st.last) / 60000)) : null;
  return (
    <div id="compte" className="scroll-mt-16">
      <Card title={t("Mon compte")} hint={t("Votre compte personnel : il ouvre la famille sur n’importe quel téléphone.")}>
        <p className="text-[13px] text-[#6B6455]">{myEmail()}</p>
        <div className="mt-3 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label={t("Votre nom")} className="min-h-11 min-w-0 flex-1 rounded-[12px] border border-or-pale bg-white px-3 text-[14px]" />
          <GhostButton
            onClick={async () => {
              setErr(null);
              try {
                await rpc("nr_set_profile", { name });
                await refreshMembers();
                setMsg(t("Nom enregistré."));
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
          >
            {t("Enregistrer")}
          </GhostButton>
        </div>
        <div className="mt-3 flex gap-2">
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" minLength={8} autoComplete="new-password" placeholder={t("Nouveau mot de passe")} className="min-h-11 min-w-0 flex-1 rounded-[12px] border border-or-pale bg-white px-3 text-[14px]" />
          <GhostButton
            disabled={pw.length < 8}
            onClick={async () => {
              setErr(null);
              try {
                await changePassword(pw);
                setPw("");
                setMsg(t("Mot de passe changé."));
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
          >
            {t("Changer")}
          </GhostButton>
        </div>
        {msg && <p className="mt-2 text-[12px] text-foret">{msg}</p>}
        <ErrorNote message={err} />
        <div className="mt-4 rounded-[14px] bg-kapok px-3 py-2.5 text-[12px] leading-relaxed text-foret">
          <p>
            <b>{st.live ? t("En direct") : st.error ? t("Hors ligne") : t("Connecté")}</b>
            {" · "}
            {st.busy ? t("synchronisation…") : ago === null ? "" : ago < 1 ? t("à jour") : t("il y a {n} min", { n: ago })}
          </p>
          <p>{t("Chaque ajout apparaît aussitôt sur les téléphones de la famille. Sans Internet, tout reste utilisable et part dès le retour du réseau.")}</p>
          {st.refused ? <p className="mt-1 text-terre">{t("Certaines modifications n’ont pas été acceptées : votre rôle ne le permet pas.")}</p> : null}
        </div>
        <div className="mt-3 flex gap-2">
          <GhostButton className="flex-1" disabled={st.busy} onClick={() => void syncNow()}>
            {t("Synchroniser")}
          </GhostButton>
          <GhostButton
            className="flex-1"
            onClick={async () => {
              if (!(await askConfirm(t("Se déconnecter de ce téléphone ? La famille reste en ligne ; vous la retrouverez en vous reconnectant.")))) return;
              leaveSharing();
              await signOut();
            }}
          >
            {t("Se déconnecter")}
          </GhostButton>
        </div>
      </Card>
    </div>
  );
}

// ─── Membres, rôles, invitations ───
export function CloudMembersCard({ persons }: { persons: { id: string; name: string }[] }) {
  const t = useT();
  useSyncExternalStore(subscribeSync, getSyncStatus);
  const me = myMember();
  const admin = me?.role === "admin";
  const members = getMembers();
  const [joinId, setJoinId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const pname = (id?: string | null) => persons.find((p) => p.id === id)?.name;
  useEffect(() => {
    void refreshMembers().catch(() => undefined);
    if (admin) void familyInfo().then((f) => setJoinId(f.join_code)).catch(() => undefined);
  }, [admin]);

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const owner = members.find((m) => m.owner);
  const adminCount = members.filter((m) => m.role === "admin" && m.status === "actif").length;

  return (
    <div id="membres" className="scroll-mt-16 space-y-4">
      <Card
        title={t("Membres de la famille")}
        hint={t("Administrateur : tout, y compris les rôles et les invitations (3 au plus). Éditeur : modifie l’arbre, les récits et les souvenirs. Lecteur : voit tout, allume des bougies, laisse des mots, et complète sa propre fiche une seule fois.")}
      >
        <ErrorNote message={err} />
        <ul className="mt-2 divide-y divide-or-pale/40">
          {members.map((m) => (
            <MemberRow key={m.user_id} m={m} admin={admin} isOwnerMe={owner?.user_id === myUid()} canPromote={adminCount < 3} persons={persons} pname={pname} busy={busy} act={act} />
          ))}
        </ul>
        {admin && joinId && (
          <p className="mt-3 rounded-[14px] bg-kapok px-3 py-2.5 text-[12px] leading-relaxed text-foret">
            {t("Identifiant de la famille")} : <b className="font-serif text-[15px] tracking-[2px]">{joinId}</b>
            <br />
            {t("Quelqu’un qui le tape envoie une demande ; vous l’acceptez ici.")}
          </p>
        )}
      </Card>
      {admin && <InvitationsCard persons={persons} />}
    </div>
  );
}

function MemberRow({ m, admin, isOwnerMe, canPromote, persons, pname, busy, act }: { m: CloudMember; admin: boolean; isOwnerMe: boolean; canPromote: boolean; persons: { id: string; name: string }[]; pname: (id?: string | null) => string | undefined; busy: string | null; act: (k: string, fn: () => Promise<unknown>) => Promise<void> }) {
  const t = useT();
  const self = m.user_id === myUid();
  return (
    <li className="py-3">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-ebene">
            {m.name || t("Sans nom")} {self && <span className="text-[12px] text-[#6B6455]">({t("vous")})</span>}
          </span>
          <span className="block truncate text-[12px] text-[#6B6455]">{m.person_id ? t("Dans l’arbre : {nom}", { nom: pname(m.person_id) ?? "?" }) : t("Pas encore dans l’arbre")}</span>
        </span>
        {m.creator ? <span className="rounded-full bg-nuit px-2.5 py-1 text-[11px] font-semibold text-or">{t("Fondateur")}</span> : m.owner ? <span className="rounded-full border border-nuit px-2.5 py-1 text-[11px] font-semibold text-nuit">{t("Administrateur principal")}</span> : <RoleBadge admin={m.role === "admin"} role={m.role} />}
      </div>
      {m.status === "en_attente" && admin && (
        <div className="mt-2 flex items-center gap-2 rounded-[12px] bg-or/10 p-2 text-[12px] text-or-fonce">
          <span className="flex-1">{t("Demande à rejoindre la famille")}</span>
          <button disabled={!!busy} onClick={() => void act(m.user_id, () => setMember(m.user_id, { accept: true }))} className="min-h-9 rounded-full bg-foret px-3 text-coton">{t("Accepter")}</button>
          <button disabled={!!busy} onClick={() => void act(m.user_id, () => removeMember(m.user_id))} className="min-h-9 rounded-full border border-terre/50 px-3 text-terre">{t("Refuser")}</button>
        </div>
      )}
      {m.requested_person_id && admin && (
        <div className="mt-2 flex items-center gap-2 rounded-[12px] bg-or/10 p-2 text-[12px] text-or-fonce">
          <span className="flex-1">{t("Dit être {nom} dans l’arbre", { nom: pname(m.requested_person_id) ?? "?" })}</span>
          <button disabled={!!busy} onClick={() => void act(m.user_id, () => setMember(m.user_id, { personId: m.requested_person_id! }))} className="min-h-9 rounded-full bg-foret px-3 text-coton">{t("Confirmer")}</button>
          <button disabled={!!busy} onClick={() => void act(m.user_id, () => setMember(m.user_id, { clearPerson: true }))} className="min-h-9 rounded-full border border-terre/50 px-3 text-terre">{t("Refuser")}</button>
        </div>
      )}
      {admin && m.status === "actif" && !m.owner && (
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value={m.role}
            disabled={!!busy || self || (m.role === "admin" && !isOwnerMe)}
            onChange={(e) => void act(m.user_id, () => setMember(m.user_id, { role: e.target.value as CloudMember["role"] }))}
            aria-label={t("Rôle")}
            className={sel}
          >
            {(["admin", "editeur", "lecteur"] as const).map((r) => (
              <option key={r} value={r} disabled={r === "admin" && m.role !== "admin" && !canPromote}>
                {t(ROLE_LABEL[r])}
              </option>
            ))}
          </select>
          <select
            value={m.person_id ?? ""}
            disabled={!!busy}
            onChange={(e) => void act(m.user_id, () => (e.target.value ? setMember(m.user_id, { personId: e.target.value }) : setMember(m.user_id, { clearPerson: true })))}
            aria-label={t("Sa fiche dans l’arbre")}
            className={`${sel} max-w-[60%]`}
          >
            <option value="">{t("Pas dans l’arbre")}</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {!self && (
            <button
              disabled={!!busy}
              onClick={async () => {
                if (await askConfirm(t("Retirer {nom} de la famille ? Son compte ne verra plus l’arbre.", { nom: m.name }))) void act(m.user_id, () => removeMember(m.user_id));
              }}
              className="min-h-10 px-2 text-[12px] text-terre underline"
            >
              {t("Retirer")}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function InvitationsCard({ persons }: { persons: { id: string; name: string }[] }) {
  const t = useT();
  const [role, setRole] = useState<"lecteur" | "editeur">("lecteur");
  const [personId, setPersonId] = useState("");
  const [list, setList] = useState<CloudInvitation[]>([]);
  const [shown, setShown] = useState<{ code: string; qr: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => void listInvitations().then(setList).catch(() => undefined);
  useEffect(load, []);
  const show = async (code: string) => setShown({ code, qr: await QRCode.toDataURL(joinCode(code), { margin: 1, width: 420, color: { dark: "#12261A", light: "#FBF6EC" } }) });
  const pname = (id?: string | null) => persons.find((p) => p.id === id)?.name;
  return (
    <div id="inviter" className="scroll-mt-16">
      <Card title={t("Inviter")} hint={t("Le proche installe l’application, crée son compte, puis scanne ce QR code avec le scanner de l’application (ou tape le code). Toute la famille arrive sur son téléphone.")}>
        <div className="flex flex-wrap gap-2">
          <select value={role} onChange={(e) => setRole(e.target.value as "lecteur" | "editeur")} aria-label={t("Rôle")} className={sel}>
            <option value="lecteur">{t("Lecteur")}</option>
            <option value="editeur">{t("Éditeur")}</option>
          </select>
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} aria-label={t("Pour qui")} className={`${sel} max-w-[60%]`}>
            <option value="">{t("Pour toute la famille")}</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {t("Pour {nom}", { nom: p.name })}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-[#6B6455]">{personId ? t("Code à usage unique : la personne sera directement reliée à sa fiche.") : t("Valable 30 jours, pour plusieurs personnes. Chacun choisira ensuite sa fiche dans l’arbre.")}</p>
        <ErrorNote message={err} />
        <GhostButton
          className="mt-3 w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              const code = await createInvitation({ role, personId: personId || undefined, label: personId ? pname(personId) : undefined });
              await show(code);
              load();
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "…" : t("Créer un QR code d’invitation")}
        </GhostButton>
        {shown && (
          <div className="mt-4 rounded-[18px] bg-kapok p-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown.qr} alt="" className="mx-auto h-52 w-52 rounded-[12px]" />
            <p className="mt-2 font-serif text-[22px] tracking-[4px] text-nuit">{shown.code}</p>
            <button
              onClick={async () => {
                const blob = await (await fetch(shown.qr)).blob();
                await exportBlob(`invitation-${shown.code}.png`, blob).catch(() => undefined);
              }}
              className="mt-1 text-[12px] text-foret underline"
            >
              {t("Envoyer le QR code")}
            </button>
          </div>
        )}
        {list.length > 0 && (
          <ul className="mt-4 space-y-2">
            {list.map((i) => (
              <li key={i.code} className="flex items-center gap-2 rounded-[12px] border border-or-pale/60 px-3 py-2 text-[12px]">
                <button onClick={() => void show(i.code)} className="font-serif text-[15px] tracking-[2px] text-nuit underline-offset-4 hover:underline">
                  {i.code}
                </button>
                <span className="min-w-0 flex-1 truncate text-[#6B6455]">
                  {t(ROLE_LABEL[i.role])} · {i.person_id ? pname(i.person_id) ?? i.label : t("{n} utilisation(s)", { n: i.uses })}
                </span>
                <button onClick={async () => (await revokeInvitation(i.code), load(), shown?.code === i.code && setShown(null))} className="text-terre underline">
                  {t("Annuler")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ─── Historique ───
const ACTION: Record<string, string> = {
  ajout: "a ajouté",
  modification: "a modifié",
  suppression: "a supprimé",
  role: "a changé le rôle de",
  adhesion: "a rejoint la famille",
  demande: "demande à rejoindre la famille",
  identification: "s’est identifié(e) dans l’arbre",
  invitation: "a créé une invitation",
  retrait: "a retiré de la famille",
  creation: "a créé la famille",
};
const COLL: Record<string, string> = {
  persons: "la fiche",
  unions: "une union",
  parentages: "une filiation",
  stories: "le récit",
  memories: "le souvenir",
  media: "une photo ou une voix",
  tributes: "un hommage",
  capsules: "un coffre",
  family: "la famille",
  settings: "les réglages",
};
const FIELD: Record<string, string> = {
  givenName: "prénom", familyName: "nom", nickname: "surnom", birthYear: "naissance", birthDate: "naissance", deathYear: "décès", deathDate: "décès",
  village: "village", job: "métier", bio: "histoire", photoId: "photo", photoIds: "photos", isLiving: "vivant(e)", sex: "sexe", quote: "citation",
  timeline: "étapes de vie", livesIn: "lieu de vie", separated: "séparation", separatedYear: "année de séparation", title: "titre", text: "texte",
};

const HIDDEN = new Set(["selfEditedAt", "updatedAt", "createdAt", "id", "placeholder"]);

export function CloudHistoryCard() {
  const t = useT();
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const load = async (before?: number) => {
    try {
      const r = await history(before);
      setItems((x) => (before ? [...x, ...r] : r));
      setMore(r.length >= 60);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div id="historique" className="scroll-mt-16">
      <Card title={t("Historique des modifications")} hint={t("Qui a modifié quoi, et quand. Visible par les administrateurs et les éditeurs.")}>
        {!open ? (
          <GhostButton className="w-full" onClick={() => (setOpen(true), void load())}>
            {t("Voir l’historique")}
          </GhostButton>
        ) : (
          <>
            <ErrorNote message={err} />
            <ul className="space-y-2">
              {items.map((h) => (
                <li key={h.id} className="rounded-[12px] bg-white/70 px-3 py-2 text-[13px] leading-snug text-ebene">
                  <b>{h.user_name || t("Quelqu’un")}</b> {h.action === "identification" && h.fields?.[0] === "validee" ? t("a relié à sa fiche") : t(ACTION[h.action] ?? h.action)}
                  {h.coll && COLL[h.coll] && !["role", "adhesion", "identification", "retrait"].includes(h.action) ? ` ${t(COLL[h.coll])}` : ""}
                  {h.label ? <span className="text-foret"> « {h.label} »</span> : null}
                  {h.fields?.length && h.action === "modification" ? (
                    <span className="text-[#6B6455]"> ({h.fields.filter((f) => !HIDDEN.has(f)).map((f) => t(FIELD[f] ?? f)).slice(0, 5).join(", ")})</span>
                  ) : h.action === "role" && h.fields?.[0] ? (
                    <span className="text-[#6B6455]"> : {t(ROLE_LABEL[h.fields[0] as keyof typeof ROLE_LABEL] ?? h.fields[0])}</span>
                  ) : null}
                  <span className="mt-0.5 block text-[11px] text-[#8A8270]">{new Date(h.at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
            {more && items.length > 0 && (
              <GhostButton className="mt-3 w-full" onClick={() => void load(items[items.length - 1].id)}>
                {t("Plus ancien")}
              </GhostButton>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
