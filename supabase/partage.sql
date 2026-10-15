-- ═══════════════════════════════════════════════════════════════════
-- NOS RACINES — la famille en ligne, unique et partagée.
-- À coller dans Supabase : SQL Editor → New query → Run (on peut le relancer sans risque).
--
-- Chaque famille a UN arbre, stocké ici. Chaque personne a son propre compte
-- (e-mail et mot de passe). Les membres d'une famille lisent et modifient le même arbre,
-- selon leur rôle ; chaque modification est enregistrée dans l'historique et
-- arrive aussitôt sur les autres téléphones.
--
--   nr_users            les comptes (profil)               ← users/
--   nr_families         les familles (familyId)            ← families/
--   nr_family_members   qui appartient à quelle famille     ← familyMembers/
--                       (rôle, personne de l'arbre)
--   nr_invitations      les codes et QR « Rejoindre »       ← invitations/
--   nr_records          le contenu de la famille : fiches,  ← families/{id}/…
--                       unions, filiations, récits, souvenirs, bougies, coffres…
--   nr_audit_logs       l'historique : qui, quoi, quand     ← auditLogs/
--   stockage « medias »    photos, voix, vidéos (privé, réservé à la famille)
--   stockage « portraits » portraits montrés par les QR codes des fiches (public)
--
-- Personne ne peut écrire directement dans les tables : tout passe par les fonctions
-- ci-dessous, qui vérifient le compte connecté (auth.uid()) et son rôle.
-- ═══════════════════════════════════════════════════════════════════

-- Première version (jamais mise en service) : on la retire.
drop function if exists nr_create(text, text), nr_push(text, text, jsonb), nr_pull(text, text, bigint), nr_put_media(text, text, text, text, text),
  nr_get_media(text, text, text), nr_has_media(text, text), nr_ping(text, text, text, text), nr_set_public(text, text, text[]), nr_public_media(text, text),
  nr_set_recovery(text, text, text, text), nr_get_recovery(text), nr_coffre_put(text, text, text, date, text, text), nr_coffre_get(text, text, text),
  nr_coffre_author(text, text, text, text), nr_check(text, text);
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'nr_families' and column_name = 'key_hash') then
    drop table if exists nr_recovery, nr_public, nr_coffres, nr_media, nr_records, nr_devices, nr_days, nr_families cascade;
  end if;
end $$;

-- ─── Tables ─────────────────────────────────────────────────────────

create table if not exists nr_users (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default '',
  creator       boolean not null default false,   -- le créateur de l'application (titre « Fondateur »)
  created_at    timestamptz not null default now()
);

create table if not exists nr_families (
  id          text primary key,                     -- familyId
  name        text not null,
  join_code   text not null unique,                 -- identifiant familial à taper (demande d'adhésion)
  created_by  uuid not null references nr_users(id),
  legacy      jsonb not null default '[]',          -- anciens comptes du téléphone du fondateur (migration)
  created_at  timestamptz not null default now()
);

create table if not exists nr_family_members (
  family_id            text not null references nr_families(id) on delete cascade,
  user_id              uuid not null references nr_users(id) on delete cascade,
  role                 text not null default 'lecteur' check (role in ('admin', 'editeur', 'lecteur')),
  status               text not null default 'actif' check (status in ('actif', 'en_attente')),
  person_id            text,                        -- « c'est moi dans l'arbre »
  requested_person_id  text,                        -- « c'est moi » en attente de validation
  self_edited_at       timestamptz,                 -- sa fiche complétée (une seule fois)
  joined_at            timestamptz not null default now(),
  primary key (family_id, user_id)
);
create unique index if not exists nr_family_members_person on nr_family_members (family_id, person_id) where person_id is not null;
create index if not exists nr_family_members_user on nr_family_members (user_id);

create table if not exists nr_invitations (
  code        text primary key,
  family_id   text not null references nr_families(id) on delete cascade,
  role        text not null default 'lecteur' check (role in ('editeur', 'lecteur')),
  person_id   text,                                 -- invitation pour une personne précise de l'arbre
  label       text,
  created_by  uuid references nr_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  max_uses    int,                                  -- vide : sans limite
  uses        int not null default 0,
  revoked     boolean not null default false
);
create index if not exists nr_invitations_family on nr_invitations (family_id);

create sequence if not exists nr_seq;

-- Le contenu de la famille : une ligne par fiche, union, récit, bougie…
create table if not exists nr_records (
  family_id   text not null references nr_families(id) on delete cascade,
  coll        text not null,
  id          text not null,
  data        jsonb,
  deleted     boolean not null default false,
  rev         int not null default 1,               -- numéro de version (évite d'écraser le travail d'un autre)
  seq         bigint not null default nextval('nr_seq'),
  created_by  uuid,
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  primary key (family_id, coll, id)
);
create index if not exists nr_records_seq on nr_records (family_id, seq);

create table if not exists nr_audit_logs (
  id          bigserial primary key,
  family_id   text not null references nr_families(id) on delete cascade,
  at          timestamptz not null default now(),
  user_id     uuid,
  user_name   text,
  action      text not null,                        -- ajout, modification, suppression, role, adhesion, invitation…
  coll        text,
  record_id   text,
  label       text,                                 -- ce qui a été touché (« Kouadio Yao »)
  fields      text[]                                -- les champs modifiés
);
create index if not exists nr_audit_family on nr_audit_logs (family_id, id desc);

-- Gardien des coffres du futur : la clé n'est rendue qu'à la date d'ouverture (horloge du serveur).
create table if not exists nr_coffres (
  family_id  text not null references nr_families(id) on delete cascade,
  cid        text not null,
  open_at    date not null,
  ckey       text not null,
  code       text not null,
  author     uuid,
  primary key (family_id, cid)
);

-- Téléphones (anonymes), pour le tableau de bord du créateur.
create table if not exists nr_devices (
  device_id   text primary key,
  family_id   text,
  app_version text,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create table if not exists nr_days (
  day        date not null,
  device_id  text not null,
  primary key (day, device_id)
);

alter table nr_users          enable row level security;
alter table nr_families       enable row level security;
alter table nr_family_members enable row level security;
alter table nr_invitations    enable row level security;
alter table nr_records        enable row level security;
alter table nr_audit_logs     enable row level security;
alter table nr_coffres        enable row level security;
alter table nr_devices        enable row level security;
alter table nr_days           enable row level security;

-- ─── Outils internes ────────────────────────────────────────────────

-- Rôle du compte connecté dans une famille (vide s'il n'en est pas membre actif).
create or replace function nr_role(fid text) returns text
language sql stable security definer set search_path = public as $$
  select m.role from nr_family_members m where m.family_id = fid and m.user_id = auth.uid() and m.status = 'actif'
$$;

create or replace function nr_need(fid text, roles text[]) returns text
language plpgsql stable security definer set search_path = public as $$
declare r text;
begin
  if auth.uid() is null then raise exception 'NR_CONNEXION'; end if;
  r := nr_role(fid);
  if r is null or not (r = any(roles)) then raise exception 'NR_ACCES_REFUSE'; end if;
  return r;
end $$;

create or replace function nr_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(display_name, ''), 'Quelqu’un') from nr_users where id = auth.uid()
$$;

create or replace function nr_log(fid text, act text, c text, rid text, lbl text, f text[]) returns void
language sql security definer set search_path = public as $$
  insert into nr_audit_logs (family_id, user_id, user_name, action, coll, record_id, label, fields)
  values (fid, auth.uid(), nr_name(), act, c, rid, left(lbl, 160), f)
$$;

-- Les membres ont changé : un petit signal dans les fiches, que tous les téléphones reçoivent.
create or replace function nr_touch_members(fid text) returns void
language sql security definer set search_path = public as $$
  insert into nr_records (family_id, coll, id, data, rev, seq, updated_at)
  values (fid, '_membres', 'liste', jsonb_build_object('at', extract(epoch from now())), 1, nextval('nr_seq'), now())
  on conflict (family_id, coll, id) do update set data = excluded.data, rev = nr_records.rev + 1, seq = excluded.seq, updated_at = now()
$$;

create or replace function nr_code(n int) returns text
language sql volatile as $$
  select string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, n)
$$;

-- Nom lisible d'une fiche pour l'historique.
create or replace function nr_label(c text, d jsonb) returns text
language sql immutable as $$
  select case
    when d is null then null
    when c = 'persons' then trim(coalesce(d->>'givenName', '') || ' ' || coalesce(d->>'familyName', ''))
    when c in ('stories', 'capsules') then coalesce(d->>'title', '')
    when c = 'memories' then coalesce(d->>'caption', '')
    when c = 'tributes' then coalesce(d->>'kind', '')
    when c = 'family' then coalesce(d->>'name', '')
    else null end
$$;

-- ─── Comptes ────────────────────────────────────────────────────────

-- Mon profil et mes familles.
create or replace function nr_me() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NR_CONNEXION'; end if;
  insert into nr_users (id) values (auth.uid()) on conflict do nothing;
  return jsonb_build_object(
    'user', (select to_jsonb(u) from nr_users u where u.id = auth.uid()),
    'families', (select coalesce(jsonb_agg(jsonb_build_object(
        'family_id', f.id, 'name', f.name, 'role', m.role, 'status', m.status, 'person_id', m.person_id,
        'requested_person_id', m.requested_person_id, 'self_edited_at', m.self_edited_at, 'owner', f.created_by = auth.uid()) order by m.joined_at), '[]'::jsonb)
      from nr_family_members m join nr_families f on f.id = m.family_id where m.user_id = auth.uid())
  );
end $$;

create or replace function nr_set_profile(name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NR_CONNEXION'; end if;
  insert into nr_users (id, display_name) values (auth.uid(), left(trim(name), 80))
  on conflict (id) do update set display_name = excluded.display_name;
  update nr_records r set seq = nextval('nr_seq') where r.coll = '_membres' and r.family_id in (select family_id from nr_family_members where user_id = auth.uid());
end $$;

-- Le créateur de l'application prouve qui il est avec son code créateur.
create or replace function nr_claim_creator(pin text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NR_CONNEXION'; end if;
  if encode(sha256(convert_to('nos-racines-createur:' || upper(pin), 'UTF8')), 'hex') <> 'e9e3ad901f54efca088eff991740713021e26c52929ff1e23572aed296f9ac33' then
    raise exception 'NR_ACCES_REFUSE';
  end if;
  update nr_users set creator = true where id = auth.uid();
  return true;
end $$;

-- ─── Familles ───────────────────────────────────────────────────────

-- Créer une famille (ou mettre en ligne celle qui était dans le téléphone : même identifiant).
drop function if exists nr_create_family(text, text, jsonb);
create or replace function nr_create_family(fid text, fname text, legacy jsonb default '[]', me_person text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare jc text;
begin
  if auth.uid() is null then raise exception 'NR_CONNEXION'; end if;
  if length(fid) < 8 or length(fid) > 64 then raise exception 'NR_IDENTIFIANT'; end if;
  insert into nr_users (id) values (auth.uid()) on conflict do nothing;
  if exists (select 1 from nr_families where id = fid) then
    -- Déjà en ligne : seul un administrateur peut la « recréer » (sans effet).
    perform nr_need(fid, array['admin']);
    return jsonb_build_object('family_id', fid, 'join_code', (select join_code from nr_families where id = fid), 'created', false);
  end if;
  loop
    jc := nr_code(6);
    exit when not exists (select 1 from nr_families where join_code = jc);
  end loop;
  insert into nr_families (id, name, join_code, created_by, legacy) values (fid, left(trim(fname), 120), jc, auth.uid(), coalesce(legacy, '[]'));
  insert into nr_family_members (family_id, user_id, role, person_id) values (fid, auth.uid(), 'admin', me_person);
  perform nr_log(fid, 'creation', 'family', 'family', fname, null);
  perform nr_touch_members(fid);
  return jsonb_build_object('family_id', fid, 'join_code', jc, 'created', true);
end $$;

-- Les membres d'une famille (pour tous les membres actifs).
create or replace function nr_members(fid text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := nr_need(fid, array['admin', 'editeur', 'lecteur']);
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', m.user_id, 'name', u.display_name, 'role', m.role, 'status', m.status, 'person_id', m.person_id,
      'requested_person_id', m.requested_person_id, 'self_edited_at', m.self_edited_at, 'joined_at', m.joined_at,
      'creator', u.creator, 'owner', f.created_by = m.user_id) order by m.joined_at), '[]'::jsonb)
    from nr_family_members m join nr_users u on u.id = m.user_id join nr_families f on f.id = m.family_id
    where m.family_id = fid and (m.status = 'actif' or r = 'admin'));
end $$;

-- Nom, identifiant familial (pour les administrateurs).
create or replace function nr_family_info(fid text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := nr_need(fid, array['admin', 'editeur', 'lecteur']);
  return (select jsonb_build_object('family_id', f.id, 'name', f.name, 'owner', f.created_by,
            'join_code', case when r = 'admin' then f.join_code end) from nr_families f where f.id = fid);
end $$;

-- ─── Invitations et adhésions ───────────────────────────────────────

-- Un administrateur crée un code « Rejoindre » (QR code). Rôle : lecteur ou éditeur.
-- Pour une personne précise de l'arbre : le code ne sert qu'une fois et la relie à cette fiche.
create or replace function nr_create_invitation(fid text, role text default 'lecteur', person_id text default null, max_uses int default null, days int default 30, label text default null) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  perform nr_need(fid, array['admin']);
  if role not in ('editeur', 'lecteur') then raise exception 'NR_ROLE'; end if;
  loop
    c := nr_code(8);
    exit when not exists (select 1 from nr_invitations where code = c);
  end loop;
  insert into nr_invitations (code, family_id, role, person_id, label, created_by, expires_at, max_uses)
  values (c, fid, nr_create_invitation.role, nr_create_invitation.person_id, left(nr_create_invitation.label, 80), auth.uid(),
          case when days is null or days <= 0 then null else now() + make_interval(days => least(days, 3650)) end,
          case when nr_create_invitation.person_id is not null then 1 else nr_create_invitation.max_uses end);
  perform nr_log(fid, 'invitation', null, c, coalesce(nr_create_invitation.label, nr_create_invitation.role), null);
  return c;
end $$;

create or replace function nr_invitations_list(fid text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform nr_need(fid, array['admin']);
  return (select coalesce(jsonb_agg(to_jsonb(i) - 'family_id' order by i.created_at desc), '[]'::jsonb)
    from nr_invitations i where i.family_id = fid and not i.revoked and (i.expires_at is null or i.expires_at > now()) and (i.max_uses is null or i.uses < i.max_uses));
end $$;

create or replace function nr_revoke_invitation(c text) returns void
language plpgsql security definer set search_path = public as $$
declare fid text;
begin
  select family_id into fid from nr_invitations where code = upper(c);
  if fid is null then return; end if;
  perform nr_need(fid, array['admin']);
  update nr_invitations set revoked = true where code = upper(c);
end $$;

-- Rejoindre avec un code d'invitation (QR code ou tapé). « legacy_user » : l'ancien compte
-- de ce téléphone dans la même famille (mise en ligne d'une famille déjà commencée).
create or replace function nr_join(c text, legacy_user text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i nr_invitations; pid text; rl text; old jsonb; n_admin int;
begin
  if auth.uid() is null then raise exception 'NR_CONNEXION'; end if;
  insert into nr_users (id) values (auth.uid()) on conflict do nothing;
  select * into i from nr_invitations where code = upper(regexp_replace(c, '[^A-Za-z0-9]', '', 'g')) for update;
  if i.code is null or i.revoked or (i.expires_at is not null and i.expires_at < now()) or (i.max_uses is not null and i.uses >= i.max_uses) then
    raise exception 'NR_INVITATION';
  end if;
  if exists (select 1 from nr_family_members where family_id = i.family_id and user_id = auth.uid() and status = 'actif') then
    return jsonb_build_object('family_id', i.family_id, 'already', true);
  end if;
  rl := i.role;
  pid := i.person_id;
  -- Ancien compte retrouvé : on lui rend sa fiche et son rôle.
  if pid is null and legacy_user is not null then
    select x into old from nr_families f, jsonb_array_elements(f.legacy) x where f.id = i.family_id and x->>'id' = legacy_user;
    if old is not null then
      pid := old->>'personId';
      if old->>'role' = 'admin' then
        select count(*) into n_admin from nr_family_members where family_id = i.family_id and role = 'admin';
        rl := case when n_admin < 3 then 'admin' else 'editeur' end;
      end if;
    end if;
  end if;
  if pid is not null and exists (select 1 from nr_family_members where family_id = i.family_id and person_id = pid) then pid := null; end if;
  insert into nr_family_members (family_id, user_id, role, status, person_id) values (i.family_id, auth.uid(), rl, 'actif', pid)
  on conflict (family_id, user_id) do update set status = 'actif', role = excluded.role, person_id = coalesce(nr_family_members.person_id, excluded.person_id);
  update nr_invitations set uses = uses + 1 where code = i.code;
  perform nr_log(i.family_id, 'adhesion', null, auth.uid()::text, nr_name(), array[rl]);
  perform nr_touch_members(i.family_id);
  return jsonb_build_object('family_id', i.family_id, 'role', rl, 'person_id', pid);
end $$;

-- Demander à rejoindre avec l'identifiant familial : un administrateur doit accepter.
create or replace function nr_request_join(join_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare fid text; fname text;
begin
  if auth.uid() is null then raise exception 'NR_CONNEXION'; end if;
  insert into nr_users (id) values (auth.uid()) on conflict do nothing;
  select id, name into fid, fname from nr_families where nr_families.join_code = upper(regexp_replace(nr_request_join.join_code, '[^A-Za-z0-9]', '', 'g'));
  if fid is null then raise exception 'NR_FAMILLE_INCONNUE'; end if;
  insert into nr_family_members (family_id, user_id, role, status) values (fid, auth.uid(), 'lecteur', 'en_attente') on conflict do nothing;
  perform nr_log(fid, 'demande', null, auth.uid()::text, nr_name(), null);
  perform nr_touch_members(fid);
  return jsonb_build_object('family_id', fid, 'name', fname);
end $$;

-- « C'est moi dans l'arbre » : une demande, qu'un administrateur valide.
create or replace function nr_claim_person(fid text, pid text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform nr_need(fid, array['admin', 'editeur', 'lecteur']);
  if not exists (select 1 from nr_records where family_id = fid and coll = 'persons' and id = pid and not deleted) then raise exception 'NR_INTROUVABLE'; end if;
  if exists (select 1 from nr_family_members where family_id = fid and person_id = pid) then raise exception 'NR_DEJA_PRIS'; end if;
  update nr_family_members set requested_person_id = pid where family_id = fid and user_id = auth.uid() and person_id is null;
  perform nr_log(fid, 'identification', 'persons', pid, (select nr_label('persons', data) from nr_records where family_id = fid and coll = 'persons' and id = pid), null);
  perform nr_touch_members(fid);
end $$;

-- Un administrateur gère un membre : rôle, fiche de l'arbre, acceptation (3 administrateurs au plus).
create or replace function nr_set_member(fid text, uid uuid, role text default null, person_id text default null, accept boolean default null, clear_person boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare m nr_family_members; n_admin int; owner uuid;
begin
  perform nr_need(fid, array['admin']);
  select * into m from nr_family_members where family_id = fid and user_id = uid for update;
  if m.user_id is null then raise exception 'NR_INTROUVABLE'; end if;
  select created_by into owner from nr_families where id = fid;
  if nr_set_member.role is not null and nr_set_member.role <> m.role then
    if nr_set_member.role not in ('admin', 'editeur', 'lecteur') then raise exception 'NR_ROLE'; end if;
    if uid = owner then raise exception 'NR_FONDATEUR_FAMILLE'; end if;
    if nr_set_member.role = 'admin' then
      select count(*) into n_admin from nr_family_members x where x.family_id = fid and x.role = 'admin' and x.status = 'actif';
      if n_admin >= 3 then raise exception 'NR_TROIS_ADMINS'; end if;
    end if;
    -- Seul l'administrateur principal (celui qui a créé la famille) retire un administrateur.
    if m.role = 'admin' and auth.uid() <> owner then raise exception 'NR_ACCES_REFUSE'; end if;
    update nr_family_members set role = nr_set_member.role where family_id = fid and user_id = uid;
    perform nr_log(fid, 'role', null, uid::text, (select display_name from nr_users where id = uid), array[nr_set_member.role]);
  end if;
  if accept is true then
    update nr_family_members set status = 'actif' where family_id = fid and user_id = uid;
    perform nr_log(fid, 'adhesion', null, uid::text, (select display_name from nr_users where id = uid), array['acceptee']);
  end if;
  if nr_set_member.person_id is not null then
    if exists (select 1 from nr_family_members where family_id = fid and nr_family_members.person_id = nr_set_member.person_id and user_id <> uid) then raise exception 'NR_DEJA_PRIS'; end if;
    update nr_family_members set person_id = nr_set_member.person_id, requested_person_id = null where family_id = fid and user_id = uid;
    perform nr_log(fid, 'identification', 'persons', nr_set_member.person_id, (select display_name from nr_users where id = uid), array['validee']);
  elsif clear_person then
    update nr_family_members set person_id = null, requested_person_id = null where family_id = fid and user_id = uid;
  end if;
  perform nr_touch_members(fid);
end $$;

-- Retirer un membre (un administrateur), ou quitter soi-même la famille.
create or replace function nr_remove_member(fid text, uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare owner uuid; target text;
begin
  if auth.uid() is null then raise exception 'NR_CONNEXION'; end if;
  select created_by into owner from nr_families where id = fid;
  if uid = owner then raise exception 'NR_FONDATEUR_FAMILLE'; end if;
  if uid <> auth.uid() then
    perform nr_need(fid, array['admin']);
    select role into target from nr_family_members where family_id = fid and user_id = uid;
    if target = 'admin' and auth.uid() <> owner then raise exception 'NR_ACCES_REFUSE'; end if;
  end if;
  delete from nr_family_members where family_id = fid and user_id = uid;
  perform nr_log(fid, 'retrait', null, uid::text, (select display_name from nr_users where id = uid), null);
  perform nr_touch_members(fid);
end $$;

-- ─── L'arbre et tout le contenu ─────────────────────────────────────

-- Qui peut écrire quoi (vérifié ici, sur le serveur, pour chaque fiche).
--   administrateur, éditeur : tout l'arbre (fiches, unions, filiations, récits, souvenirs, médias)
--   administrateur seul      : la famille elle-même, ses réglages
--   lecteur                  : SA fiche, une seule fois ; bougies et mots ; ses coffres ; ses scores ; ses médias
create or replace function nr_write(fid text, changes jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r text; me nr_family_members; c jsonb; cur nr_records; v_coll text; rid text; del boolean; base int;
  ok jsonb := '[]'; conflicts jsonb := '[]'; denied jsonb := '[]'; allowed boolean; mine boolean; changed text[]; act text;
begin
  r := nr_need(fid, array['admin', 'editeur', 'lecteur']);
  select * into me from nr_family_members where family_id = fid and user_id = auth.uid();
  if jsonb_array_length(changes) > 500 then raise exception 'NR_TROP_DE_CHANGEMENTS'; end if;
  for c in select * from jsonb_array_elements(changes) loop
    v_coll := c->>'coll';
    rid := c->>'id';
    del := coalesce((c->>'deleted')::boolean, false);
    base := (c->>'base_rev')::int;
    select * into cur from nr_records where family_id = fid and nr_records.coll = v_coll and id = rid for update;
    mine := cur.created_by is null or cur.created_by = auth.uid();

    allowed := case
      when v_coll in ('family', 'settings') then r = 'admin'
      when v_coll = 'translations' then true
      when v_coll in ('persons', 'unions', 'parentages', 'stories', 'memories') and r in ('admin', 'editeur') then true
      when v_coll = 'persons' then
        -- Un lecteur complète SA fiche, une seule fois (jamais celle d'un autre, jamais d'effacement).
        rid = me.person_id and me.self_edited_at is null and not del and cur.id is not null and not coalesce(cur.deleted, false)
      when v_coll = 'media' then cur.id is null or mine or r in ('admin', 'editeur')
      when v_coll in ('tributes', 'capsules', 'quizScores') then cur.id is null or mine or (del and r = 'admin')
      else false
    end;
    if not allowed then
      denied := denied || jsonb_build_object('coll', v_coll, 'id', rid, 'rev', cur.rev, 'data', cur.data, 'deleted', coalesce(cur.deleted, true));
      continue;
    end if;

    -- Quelqu'un d'autre a modifié cette fiche entre-temps : le téléphone fusionne puis renvoie.
    if cur.id is not null and base is not null and base <> cur.rev then
      conflicts := conflicts || jsonb_build_object('coll', v_coll, 'id', rid, 'rev', cur.rev, 'data', cur.data, 'deleted', cur.deleted);
      continue;
    end if;
    if cur.id is not null and not del and cur.data = c->'data' and not cur.deleted then
      ok := ok || jsonb_build_object('coll', v_coll, 'id', rid, 'rev', cur.rev);
      continue;
    end if;

    if cur.id is null then
      act := 'ajout';
      changed := null;
      insert into nr_records (family_id, coll, id, data, deleted, rev, seq, created_by, updated_by)
      values (fid, v_coll, rid, case when del then null else c->'data' end, del, 1, nextval('nr_seq'), auth.uid(), auth.uid());
    else
      act := case when del then 'suppression' when cur.deleted then 'ajout' else 'modification' end;
      select array_agg(k) into changed from (
        select k from jsonb_object_keys(coalesce(c->'data', '{}'::jsonb) || coalesce(cur.data, '{}'::jsonb)) k
        where (c->'data')->k is distinct from (cur.data)->k
      ) x;
      if del then changed := null; end if;
      update nr_records set data = case when del then null else c->'data' end, deleted = del, rev = cur.rev + 1,
        seq = nextval('nr_seq'), updated_by = auth.uid(), updated_at = now()
      where family_id = fid and nr_records.coll = v_coll and id = rid;
    end if;
    if v_coll = 'persons' and r = 'lecteur' then
      update nr_family_members set self_edited_at = now() where family_id = fid and user_id = auth.uid();
      perform nr_touch_members(fid);
    end if;
    if v_coll not in ('translations', 'quizScores') then
      perform nr_log(fid, act, v_coll, rid, nr_label(v_coll, coalesce(c->'data', cur.data)), changed);
    end if;
    ok := ok || jsonb_build_object('coll', v_coll, 'id', rid, 'rev', coalesce(cur.rev + 1, 1));
  end loop;
  return jsonb_build_object('ok', ok, 'conflicts', conflicts, 'denied', denied);
end $$;

-- Récupérer l'arbre : tout ce qui a changé depuis « since » (0 : toute la famille).
create or replace function nr_pull(fid text, since bigint) returns table (coll text, id text, data jsonb, deleted boolean, rev int, seq bigint)
language plpgsql security definer set search_path = public as $$
begin
  perform nr_need(fid, array['admin', 'editeur', 'lecteur']);
  return query select r.coll, r.id, r.data, r.deleted, r.rev, r.seq from nr_records r where r.family_id = fid and r.seq > since order by r.seq limit 5000;
end $$;

-- L'historique des modifications (administrateurs et éditeurs).
create or replace function nr_history(fid text, before_id bigint default null, n int default 60) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform nr_need(fid, array['admin', 'editeur']);
  return (select coalesce(jsonb_agg(to_jsonb(a) - 'family_id' order by a.id desc), '[]'::jsonb) from (
    select * from nr_audit_logs where family_id = fid and (before_id is null or id < before_id) order by id desc limit least(n, 200)) a);
end $$;

-- Temps réel : les téléphones de la famille sont prévenus de chaque changement.
drop policy if exists nr_records_lecture on nr_records;
create policy nr_records_lecture on nr_records for select to authenticated using (nr_role(family_id) is not null);
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'nr_records') then
    alter publication supabase_realtime add table nr_records;
  end if;
end $$;

-- ─── Photos, voix, vidéos (stockage Supabase) ──────────────────────
-- medias/<familyId>/<mediaId> : privé, lisible et ajoutable par les membres de la famille.
-- portraits/<familyId>/<mediaId> : public (les QR codes des fiches montrent le visage).
create or replace function nr_storage_ok(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select nr_role(split_part(path, '/', 1)) is not null
$$;

do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit) values ('medias', 'medias', false, 52428800) on conflict (id) do nothing;
    insert into storage.buckets (id, name, public, file_size_limit) values ('portraits', 'portraits', true, 5242880) on conflict (id) do nothing;
    drop policy if exists nr_medias_lire on storage.objects;
    drop policy if exists nr_medias_ajouter on storage.objects;
    drop policy if exists nr_medias_remplacer on storage.objects;
    drop policy if exists nr_portraits_ajouter on storage.objects;
    drop policy if exists nr_portraits_remplacer on storage.objects;
    create policy nr_medias_lire on storage.objects for select to authenticated using (bucket_id = 'medias' and public.nr_storage_ok(name));
    create policy nr_medias_ajouter on storage.objects for insert to authenticated with check (bucket_id = 'medias' and public.nr_storage_ok(name));
    create policy nr_medias_remplacer on storage.objects for update to authenticated using (bucket_id = 'medias' and public.nr_storage_ok(name));
    create policy nr_portraits_ajouter on storage.objects for insert to authenticated with check (bucket_id = 'portraits' and public.nr_storage_ok(name));
    create policy nr_portraits_remplacer on storage.objects for update to authenticated using (bucket_id = 'portraits' and public.nr_storage_ok(name));
  end if;
end $$;

-- ─── Coffres du futur ───────────────────────────────────────────────

create or replace function nr_coffre_put(fid text, cid text, open_at date, ckey text, code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform nr_need(fid, array['admin', 'editeur', 'lecteur']);
  -- Une fois confiée, la clé ne peut être remplacée que par son auteur, avec le même code.
  insert into nr_coffres as c (family_id, cid, open_at, ckey, code, author) values (fid, nr_coffre_put.cid, nr_coffre_put.open_at, nr_coffre_put.ckey, upper(nr_coffre_put.code), auth.uid())
  on conflict on constraint nr_coffres_pkey do update set open_at = excluded.open_at, ckey = excluded.ckey
    where c.code = excluded.code and c.author = excluded.author;
end $$;

create or replace function nr_coffre_get(fid text, cid text) returns table (ckey text, code text)
language plpgsql security definer set search_path = public as $$
begin
  perform nr_need(fid, array['admin', 'editeur', 'lecteur']);
  return query select c.ckey, c.code from nr_coffres c where c.family_id = fid and c.cid = nr_coffre_get.cid and c.open_at <= (now() at time zone 'utc')::date;
end $$;

create or replace function nr_coffre_author(fid text, cid text, code text) returns table (ckey text)
language plpgsql security definer set search_path = public as $$
begin
  perform nr_need(fid, array['admin', 'editeur', 'lecteur']);
  return query select c.ckey from nr_coffres c where c.family_id = fid and c.cid = nr_coffre_author.cid and c.code = upper(nr_coffre_author.code);
end $$;

-- ─── Tableau de bord du créateur ────────────────────────────────────

create or replace function nr_ping(did text, fid text, version text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into nr_devices (device_id, family_id, app_version) values (left(did, 64), case when nr_role(fid) is not null then fid end, left(version, 20))
  on conflict (device_id) do update set family_id = excluded.family_id, app_version = excluded.app_version, last_seen = now();
  insert into nr_days (day, device_id) values (current_date, left(did, 64)) on conflict do nothing;
end $$;

create or replace function nr_creator_stats(pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if encode(sha256(convert_to('nos-racines-createur:' || upper(pin), 'UTF8')), 'hex') <> 'e9e3ad901f54efca088eff991740713021e26c52929ff1e23572aed296f9ac33' then
    raise exception 'NR_ACCES_REFUSE';
  end if;
  return jsonb_build_object(
    'families', (select count(*) from nr_families),
    'users', (select count(*) from nr_users),
    'devices', (select count(*) from nr_devices),
    'active7', (select count(*) from nr_devices where last_seen > now() - interval '7 days'),
    'active1', (select count(*) from nr_devices where last_seen > now() - interval '1 day'),
    'records', (select count(*) from nr_records where not deleted and coll not like '\_%'),
    'media', (select count(*) from nr_records where not deleted and coll = 'media'),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'phones', n) order by d), '[]'::jsonb)
             from (select day as d, count(*) as n from nr_days where day > current_date - 30 group by day) x),
    'adds', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
             from (select at::date as d, count(*) as n from nr_audit_logs where at > now() - interval '30 days' and action = 'ajout' group by 1) y),
    'versions', (select coalesce(jsonb_object_agg(v, n), '{}'::jsonb) from (select coalesce(app_version, '?') v, count(*) n from nr_devices group by 1) z)
  );
end $$;

-- ─── Droits ─────────────────────────────────────────────────────────

revoke all on nr_users, nr_families, nr_family_members, nr_invitations, nr_records, nr_audit_logs, nr_coffres, nr_devices, nr_days from anon, authenticated;
grant select on nr_records to authenticated;  -- filtré par la règle « nr_records_lecture » (temps réel)
revoke execute on function nr_need(text, text[]), nr_log(text, text, text, text, text, text[]), nr_touch_members(text), nr_name() from anon, authenticated, public;
grant execute on function nr_me(), nr_set_profile(text), nr_claim_creator(text), nr_create_family(text, text, jsonb, text), nr_members(text), nr_family_info(text),
  nr_create_invitation(text, text, text, int, int, text), nr_invitations_list(text), nr_revoke_invitation(text), nr_join(text, text), nr_request_join(text),
  nr_claim_person(text, text), nr_set_member(text, uuid, text, text, boolean, boolean), nr_remove_member(text, uuid), nr_write(text, jsonb), nr_pull(text, bigint),
  nr_history(text, bigint, int), nr_coffre_put(text, text, date, text, text), nr_coffre_get(text, text), nr_coffre_author(text, text, text) to authenticated;
grant execute on function nr_ping(text, text, text), nr_creator_stats(text), nr_role(text), nr_storage_ok(text) to anon, authenticated;
-- Le Griot (questions libres) : au plus 40 questions par personne et par jour.
create table if not exists nr_griot_usage (
  user_id  uuid not null,
  day      date not null default current_date,
  n        int not null default 0,
  primary key (user_id, day)
);
alter table nr_griot_usage enable row level security;
revoke all on nr_griot_usage from anon, authenticated;

-- Compte une question ; renvoie ce qu'il reste aujourd'hui (négatif : limite atteinte).
create or replace function nr_griot_tick(fid text) returns int
language plpgsql security definer set search_path = public as $$
declare used int;
begin
  perform nr_need(fid, array['admin', 'editeur', 'lecteur']);
  insert into nr_griot_usage (user_id, day, n) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set n = nr_griot_usage.n + 1
  returning n into used;
  return 40 - used;
end $$;
grant execute on function nr_griot_tick(text) to authenticated;
