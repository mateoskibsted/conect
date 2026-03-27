-- ============================================================
-- CONECT – Schema MVP v1.0
-- Ejecutar completo en Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. PROFILES
-- Extiende auth.users con datos públicos del jugador
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Trigger: crea un perfil automáticamente cuando un usuario se registra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Jugador')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. MATCHES (partidos)
-- ============================================================
create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references public.profiles(id) on delete cascade,
  sport         text not null default 'football',
  title         text not null,
  description   text,
  match_date    date not null,
  match_time    time not null,
  location      text not null,
  total_spots   int not null check (total_spots > 0 and total_spots <= 50),
  visibility    text not null default 'public' check (visibility in ('public', 'private')),
  slug          text not null unique,
  created_at    timestamptz default now()
);

-- ============================================================
-- 3. MATCH_PLAYERS (jugadores confirmados)
-- ============================================================
create table public.match_players (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  player_id  uuid not null references public.profiles(id) on delete cascade,
  is_cohost  boolean not null default false,
  joined_at  timestamptz default now(),
  unique (match_id, player_id)
);

-- ============================================================
-- 4. MATCH_GUESTS (jugadores externos sin cuenta)
-- ============================================================
create table public.match_guests (
  id        uuid primary key default gen_random_uuid(),
  match_id  uuid not null references public.matches(id) on delete cascade,
  name      text,           -- null = "Cupo ocupado"
  added_at  timestamptz default now()
);

-- ============================================================
-- 5. MATCH_REQUESTS (solicitudes de unión)
-- ============================================================
create table public.match_requests (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  player_id  uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  unique (match_id, player_id)
);

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles      enable row level security;
alter table public.matches        enable row level security;
alter table public.match_players  enable row level security;
alter table public.match_guests   enable row level security;
alter table public.match_requests enable row level security;

-- ---------- PROFILES ----------

-- Cualquiera puede leer perfiles (necesario para mostrar jugadores en el panel)
create policy "profiles: lectura pública"
  on public.profiles for select
  using (true);

-- Solo el propio usuario puede actualizar su perfil
create policy "profiles: edición propia"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------- MATCHES ----------

-- Partidos públicos: cualquiera los puede ver
-- Partidos privados: solo el creador y los jugadores anotados
create policy "matches: lectura"
  on public.matches for select
  using (
    visibility = 'public'
    or creator_id = auth.uid()
    or exists (
      select 1 from public.match_players
      where match_id = matches.id
        and player_id = auth.uid()
    )
  );

-- Solo usuarios autenticados pueden crear partidos
create policy "matches: crear"
  on public.matches for insert
  with check (auth.uid() = creator_id);

-- Solo el creador puede editar o eliminar su partido
create policy "matches: editar"
  on public.matches for update
  using (auth.uid() = creator_id);

create policy "matches: eliminar"
  on public.matches for delete
  using (auth.uid() = creator_id);

-- ---------- MATCH_PLAYERS ----------

-- La lista de jugadores es pública
create policy "match_players: lectura"
  on public.match_players for select
  using (true);

-- Solo el propio jugador puede agregarse (creador lo hace al crear el partido)
create policy "match_players: unirse"
  on public.match_players for insert
  with check (auth.uid() = player_id);

-- Solo el propio jugador puede salir
create policy "match_players: salir"
  on public.match_players for delete
  using (auth.uid() = player_id);

-- Solo el creador puede actualizar roles (cohost) via RPC set_cohost
create policy "match_players: actualizar"
  on public.match_players for update
  using (
    exists (
      select 1 from public.matches
      where id = match_players.match_id and creator_id = auth.uid()
    )
  );

-- ---------- MATCH_REQUESTS ----------

-- El jugador ve sus propias solicitudes; host y co-hosts ven todas las de su partido
create policy "match_requests: lectura"
  on public.match_requests for select
  using (
    player_id = auth.uid()
    or exists (
      select 1 from public.matches
      where id = match_requests.match_id and creator_id = auth.uid()
    )
    or exists (
      select 1 from public.match_players
      where match_id = match_requests.match_id
        and player_id = auth.uid()
        and is_cohost = true
    )
  );

-- Solo el propio usuario puede crear una solicitud para sí mismo
create policy "match_requests: insertar"
  on public.match_requests for insert
  with check (auth.uid() = player_id);

-- Host y co-hosts pueden actualizar el estado de una solicitud
create policy "match_requests: actualizar"
  on public.match_requests for update
  using (
    exists (
      select 1 from public.matches
      where id = match_requests.match_id and creator_id = auth.uid()
    )
    or exists (
      select 1 from public.match_players
      where match_id = match_requests.match_id
        and player_id = auth.uid()
        and is_cohost = true
    )
  );

-- El jugador puede retirar su propia solicitud
create policy "match_requests: retirar"
  on public.match_requests for delete
  using (auth.uid() = player_id);

-- ---------- FUNCIONES RPC ----------

-- Aceptar solicitud: inserta en match_players con privilegios elevados
create or replace function public.accept_match_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id  uuid;
  v_player_id uuid;
begin
  select match_id, player_id into v_match_id, v_player_id
  from public.match_requests
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'Solicitud no encontrada o ya procesada';
  end if;

  if not exists (
    select 1 from public.matches where id = v_match_id and creator_id = auth.uid()
  ) and not exists (
    select 1 from public.match_players
    where match_id = v_match_id and player_id = auth.uid() and is_cohost = true
  ) then
    raise exception 'No autorizado';
  end if;

  if (
    (select count(*) from public.match_players where match_id = v_match_id) +
    (select count(*) from public.match_guests   where match_id = v_match_id)
  ) >= (select total_spots from public.matches where id = v_match_id) then
    raise exception 'El partido está completo';
  end if;

  update public.match_requests set status = 'accepted' where id = p_request_id;

  insert into public.match_players (match_id, player_id)
  values (v_match_id, v_player_id)
  on conflict (match_id, player_id) do nothing;
end;
$$;

-- Asignar o quitar co-host (solo el creador)
create or replace function public.set_cohost(p_match_id uuid, p_player_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.matches where id = p_match_id and creator_id = auth.uid()
  ) then
    raise exception 'No autorizado';
  end if;

  update public.match_players
  set is_cohost = p_value
  where match_id = p_match_id and player_id = p_player_id;
end;
$$;

-- ---------- MATCH_GUESTS ----------

-- Lectura pública
create policy "match_guests: lectura"
  on public.match_guests for select
  using (true);

-- Solo el creador puede agregar invitados
create policy "match_guests: insertar"
  on public.match_guests for insert
  with check (
    exists (
      select 1 from public.matches
      where id = match_guests.match_id and creator_id = auth.uid()
    )
  );

-- Eliminar jugador registrado del partido (host o co-host)
create or replace function public.remove_match_player(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.matches where id = p_match_id and creator_id = auth.uid()
  ) then
    if p_player_id = auth.uid() then
      raise exception 'El organizador no puede eliminarse a sí mismo';
    end if;
  elsif exists (
    select 1 from public.match_players
    where match_id = p_match_id and player_id = auth.uid() and is_cohost = true
  ) then
    if p_player_id = auth.uid() then
      raise exception 'Usa cancelar participación para salir del partido';
    end if;
    if exists (select 1 from public.matches where id = p_match_id and creator_id = p_player_id) then
      raise exception 'El co-host no puede eliminar al organizador';
    end if;
  else
    raise exception 'No autorizado';
  end if;

  delete from public.match_players where match_id = p_match_id and player_id = p_player_id;
  update public.match_requests set status = 'rejected'
    where match_id = p_match_id and player_id = p_player_id;
end;
$$;

-- Eliminar invitado externo (host o co-host)
create or replace function public.remove_match_guest(p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
begin
  select match_id into v_match_id from public.match_guests where id = p_guest_id;

  if not found then
    raise exception 'Invitado no encontrado';
  end if;

  if not (
    exists (select 1 from public.matches where id = v_match_id and creator_id = auth.uid())
    or exists (
      select 1 from public.match_players
      where match_id = v_match_id and player_id = auth.uid() and is_cohost = true
    )
  ) then
    raise exception 'No autorizado';
  end if;

  delete from public.match_guests where id = p_guest_id;
end;
$$;

-- ============================================================
-- 7. STORAGE – bucket para fotos de perfil
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

-- Cualquiera puede ver las fotos
create policy "avatars: lectura pública"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Solo el propio usuario puede subir/actualizar su foto
create policy "avatars: subir propia"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: actualizar propia"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
