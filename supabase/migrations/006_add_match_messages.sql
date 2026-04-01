-- ============================================================
-- 006 – Chat de partido en tiempo real
-- ============================================================

create table public.match_messages (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null check (char_length(content) > 0 and char_length(content) <= 500),
  created_at timestamptz default now()
);

-- Índice para cargar mensajes por partido ordenados por fecha
create index match_messages_match_id_created_at_idx
  on public.match_messages (match_id, created_at asc);

-- RLS
alter table public.match_messages enable row level security;

-- Solo el creador o jugadores confirmados pueden leer el chat
create policy "members can read messages"
on public.match_messages
for select
using (
  exists (
    select 1 from public.matches m
    where m.id = match_messages.match_id
      and (
        m.creator_id = auth.uid()
        or exists (
          select 1 from public.match_players mp
          where mp.match_id = m.id
            and mp.player_id = auth.uid()
        )
      )
  )
);

-- Solo miembros pueden escribir, y solo con su propio user_id
create policy "members can send messages"
on public.match_messages
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.matches m
    where m.id = match_messages.match_id
      and (
        m.creator_id = auth.uid()
        or exists (
          select 1 from public.match_players mp
          where mp.match_id = m.id
            and mp.player_id = auth.uid()
        )
      )
  )
);

-- Habilitar la tabla en Supabase Realtime
alter publication supabase_realtime add table public.match_messages;
