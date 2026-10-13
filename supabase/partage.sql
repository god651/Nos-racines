-- ═══════════════════════════════════════════════════════════════════
-- NOS RACINES — partage en direct entre les téléphones d'une famille.
-- À coller une seule fois dans Supabase : SQL Editor → New query → Run.
--
-- Principe : chaque famille a un identifiant et une clé secrète (dans le QR code
-- « Rejoindre », que seul le scanner de l'application lit). Personne ne peut lire
-- les tables directement : tout passe par les fonctions ci-dessous, qui vérifient la clé.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists nr_families (
  id          text primary key,
  key_hash    text not null,
  created_at  timestamptz not null default now()
);

create sequence if not exists nr_seq;

-- Chaque fiche, récit, souvenir, bougie… est une ligne (son contenu en JSON).
create table if not exists nr_records (
  family_id   text not null references nr_families(id) on delete cascade,
  coll        text not null,
  id          text not null,
  data        jsonb,
  deleted     boolean not null default false,
  seq         bigint not null default nextval('nr_seq'),
  updated_at  timestamptz not null default now(),
  primary key (family_id, coll, id)
);
create index if not exists nr_records_seq on nr_records (family_id, seq);

-- Photos et voix.
create table if not exists nr_media (
  family_id   text not null references nr_families(id) on delete cascade,
  id          text not null,
  mime        text not null,
  data        bytea not null,
  created_at  timestamptz not null default now(),
  primary key (family_id, id)
);

-- Téléphones (anonymes) : pour le tableau de bord du créateur.
create table if not exists nr_devices (
  device_id   text primary key,
  family_id   text references nr_families(id) on delete cascade,
  app_version text,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create table if not exists nr_days (
  day         date not null,
  device_id   text not null,
  primary key (day, device_id)
);

alter table nr_families enable row level security;
alter table nr_records  enable row level security;
alter table nr_media    enable row level security;
alter table nr_devices  enable row level security;
alter table nr_days     enable row level security;
-- Aucune règle d'accès : seules les fonctions ci-dessous peuvent lire ou écrire.

create or replace function nr_check(fid text, fkey text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from nr_families where id = fid and key_hash = encode(sha256(convert_to(fkey, 'UTF8')), 'hex')) then
    raise exception 'NR_ACCES_REFUSE';
  end if;
end $$;

-- Création de l'espace d'une famille (par son fondateur).
create or replace function nr_create(fid text, fkey text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if length(fid) < 16 or length(fkey) < 24 then raise exception 'NR_CLE_TROP_COURTE'; end if;
  if exists (select 1 from nr_families where id = fid) then
    perform nr_check(fid, fkey);
    return false;
  end if;
  insert into nr_families (id, key_hash) values (fid, encode(sha256(convert_to(fkey, 'UTF8')), 'hex'));
  return true;
end $$;

-- Envoi des changements : [{coll, id, data, deleted}]. Renvoie le dernier numéro de suite.
create or replace function nr_push(fid text, fkey text, changes jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare c jsonb;
begin
  perform nr_check(fid, fkey);
  if jsonb_array_length(changes) = 0 then return 0; end if;
  if jsonb_array_length(changes) > 2000 then raise exception 'NR_TROP_DE_CHANGEMENTS'; end if;
  for c in select * from jsonb_array_elements(changes) loop
    insert into nr_records (family_id, coll, id, data, deleted, seq, updated_at)
    values (fid, c->>'coll', c->>'id', case when (c->>'deleted')::boolean then null else c->'data' end, coalesce((c->>'deleted')::boolean, false), nextval('nr_seq'), now())
    on conflict (family_id, coll, id) do update
      set data = excluded.data, deleted = excluded.deleted, seq = excluded.seq, updated_at = now();
  end loop;
  return currval('nr_seq');
end $$;

-- Réception : tout ce qui a changé depuis « since ».
create or replace function nr_pull(fid text, fkey text, since bigint) returns table (coll text, id text, data jsonb, deleted boolean, seq bigint)
language plpgsql security definer set search_path = public as $$
begin
  perform nr_check(fid, fkey);
  return query select r.coll, r.id, r.data, r.deleted, r.seq from nr_records r where r.family_id = fid and r.seq > since order by r.seq limit 5000;
end $$;

create or replace function nr_put_media(fid text, fkey text, mid text, mime text, b64 text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform nr_check(fid, fkey);
  if length(b64) > 14000000 then raise exception 'NR_FICHIER_TROP_GROS'; end if;
  insert into nr_media (family_id, id, mime, data) values (fid, mid, mime, decode(b64, 'base64'))
  on conflict (family_id, id) do nothing;
end $$;

create or replace function nr_get_media(fid text, fkey text, mid text) returns table (mime text, b64 text)
language plpgsql security definer set search_path = public as $$
begin
  perform nr_check(fid, fkey);
  return query select m.mime, encode(m.data, 'base64') from nr_media m where m.family_id = fid and m.id = mid;
end $$;

create or replace function nr_has_media(fid text, fkey text) returns table (id text)
language plpgsql security definer set search_path = public as $$
begin
  perform nr_check(fid, fkey);
  return query select m.id from nr_media m where m.family_id = fid;
end $$;

-- Signe de vie d'un téléphone (anonyme : un numéro au hasard, sa version).
create or replace function nr_ping(did text, fid text, fkey text, version text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform nr_check(fid, fkey);
  insert into nr_devices (device_id, family_id, app_version) values (left(did, 64), fid, left(version, 20))
  on conflict (device_id) do update set family_id = excluded.family_id, app_version = excluded.app_version, last_seen = now();
  insert into nr_days (day, device_id) values (current_date, left(did, 64)) on conflict do nothing;
end $$;

-- Tableau de bord du créateur de l'application (protégé par son code créateur).
create or replace function nr_creator_stats(pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if encode(sha256(convert_to('nos-racines-createur:' || upper(pin), 'UTF8')), 'hex') <> 'e9e3ad901f54efca088eff991740713021e26c52929ff1e23572aed296f9ac33' then
    raise exception 'NR_ACCES_REFUSE';
  end if;
  return jsonb_build_object(
    'families', (select count(*) from nr_families),
    'devices', (select count(*) from nr_devices),
    'active7', (select count(*) from nr_devices where last_seen > now() - interval '7 days'),
    'active1', (select count(*) from nr_devices where last_seen > now() - interval '1 day'),
    'records', (select count(*) from nr_records where not deleted),
    'media', (select count(*) from nr_media),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'phones', n) order by d), '[]'::jsonb)
             from (select day as d, count(*) as n from nr_days where day > current_date - 30 group by day) x),
    'adds', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
             from (select updated_at::date as d, count(*) as n from nr_records where updated_at > now() - interval '30 days' group by 1) y),
    'versions', (select coalesce(jsonb_object_agg(v, n), '{}'::jsonb) from (select coalesce(app_version, '?') v, count(*) n from nr_devices group by 1) z)
  );
end $$;

revoke all on nr_families, nr_records, nr_media, nr_devices, nr_days from anon, authenticated;
grant execute on function nr_create, nr_push, nr_pull, nr_put_media, nr_get_media, nr_has_media, nr_ping, nr_creator_stats to anon, authenticated;
revoke execute on function nr_check from anon, authenticated, public;
