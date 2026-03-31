-- Tabla de solicitudes y relaciones de amistad
-- Dos usuarios son "amigos" cuando existen AMBAS filas (A→B, accepted) y (B→A, accepted)

create table public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  addressee_id  uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

alter table public.friendships enable row level security;

-- Cualquier usuario autenticado puede leer (necesario para verificar estado)
create policy "friendships_select" on public.friendships
  for select to authenticated using (true);

-- Solo el requester puede crear la solicitud
create policy "friendships_insert" on public.friendships
  for insert to authenticated
  with check (auth.uid() = requester_id);

-- Solo el addressee puede aceptar (cambiar status)
create policy "friendships_update" on public.friendships
  for update to authenticated
  using (auth.uid() = addressee_id);

-- Cualquiera de los dos puede eliminar (cancelar/retirar)
create policy "friendships_delete" on public.friendships
  for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
