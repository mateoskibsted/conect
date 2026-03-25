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
-- 3. MATCH_PLAYERS (jugadores anotados)
-- ============================================================
create table public.match_players (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  player_id  uuid not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz default now(),
  unique (match_id, player_id)
);

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles     enable row level security;
alter table public.matches       enable row level security;
alter table public.match_players enable row level security;

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

-- La lista de jugadores es pública: se muestra en el panel del partido.
-- La privacidad de partidos privados la controla la política de matches.
create policy "match_players: lectura"
  on public.match_players for select
  using (true);

-- Solo usuarios autenticados pueden anotarse (y solo a sí mismos)
create policy "match_players: unirse"
  on public.match_players for insert
  with check (auth.uid() = player_id);

-- Solo el propio jugador puede abandonar un partido
create policy "match_players: salir"
  on public.match_players for delete
  using (auth.uid() = player_id);

-- ============================================================
-- 5. STORAGE – bucket para fotos de perfil
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
