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
