-- ============================================================
-- 007 – Permitir a co-hosts agregar cupos pre-ocupados
-- ============================================================

-- Reemplazar política de INSERT en match_guests:
-- antes solo el creador podía agregar, ahora también los co-hosts

drop policy "match_guests: insertar" on public.match_guests;

create policy "match_guests: insertar"
  on public.match_guests for insert
  with check (
    exists (
      select 1 from public.matches
      where id = match_guests.match_id
        and creator_id = auth.uid()
    )
    or exists (
      select 1 from public.match_players
      where match_id = match_guests.match_id
        and player_id = auth.uid()
        and is_cohost = true
    )
  );
