-- ============================================================
-- Migración 003: Jugadores externos (guests) + eliminar jugadores
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Nueva tabla: match_guests (jugadores sin cuenta)
CREATE TABLE IF NOT EXISTS public.match_guests (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id  uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  name      text,           -- null = "Cupo ocupado"
  added_at  timestamptz DEFAULT now()
);

ALTER TABLE public.match_guests ENABLE ROW LEVEL SECURITY;

-- Lectura pública (igual que match_players)
CREATE POLICY "match_guests: lectura"
  ON public.match_guests FOR SELECT
  USING (true);

-- Solo el creador puede agregar invitados
CREATE POLICY "match_guests: insertar"
  ON public.match_guests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE id = match_guests.match_id AND creator_id = auth.uid()
    )
  );

-- 2. RPC: eliminar jugador registrado del partido
--    Host puede eliminar a cualquiera menos a sí mismo.
--    Co-host puede eliminar a cualquiera excepto al host ni a sí mismo.
CREATE OR REPLACE FUNCTION public.remove_match_player(p_match_id uuid, p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- El creador puede eliminar a cualquier jugador (menos a sí mismo, aunque eso no tiene sentido)
  IF EXISTS (
    SELECT 1 FROM public.matches WHERE id = p_match_id AND creator_id = auth.uid()
  ) THEN
    -- El host no puede eliminarse a sí mismo
    IF p_player_id = auth.uid() THEN
      RAISE EXCEPTION 'El organizador no puede eliminarse a sí mismo';
    END IF;
  -- El co-host puede eliminar jugadores pero no al host ni a sí mismo
  ELSIF EXISTS (
    SELECT 1 FROM public.match_players
    WHERE match_id = p_match_id AND player_id = auth.uid() AND is_cohost = true
  ) THEN
    IF p_player_id = auth.uid() THEN
      RAISE EXCEPTION 'Usa cancelar participación para salir del partido';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.matches WHERE id = p_match_id AND creator_id = p_player_id
    ) THEN
      RAISE EXCEPTION 'El co-host no puede eliminar al organizador';
    END IF;
  ELSE
    RAISE EXCEPTION 'No autorizado';
  END IF;

  DELETE FROM public.match_players
  WHERE match_id = p_match_id AND player_id = p_player_id;

  -- Marcar su solicitud como rechazada para que vea que fue removido
  UPDATE public.match_requests
  SET status = 'rejected'
  WHERE match_id = p_match_id AND player_id = p_player_id;
END;
$$;

-- 3. RPC: eliminar invitado externo del partido
--    Solo host y co-host pueden hacerlo.
CREATE OR REPLACE FUNCTION public.remove_match_guest(p_guest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id uuid;
BEGIN
  SELECT match_id INTO v_match_id FROM public.match_guests WHERE id = p_guest_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitado no encontrado';
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.matches WHERE id = v_match_id AND creator_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.match_players
      WHERE match_id = v_match_id AND player_id = auth.uid() AND is_cohost = true
    )
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  DELETE FROM public.match_guests WHERE id = p_guest_id;
END;
$$;

-- 4. Actualizar accept_match_request para que cuente también los guests al verificar cupos
CREATE OR REPLACE FUNCTION public.accept_match_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id  uuid;
  v_player_id uuid;
BEGIN
  SELECT match_id, player_id INTO v_match_id, v_player_id
  FROM public.match_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada o ya procesada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.matches WHERE id = v_match_id AND creator_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.match_players
    WHERE match_id = v_match_id AND player_id = auth.uid() AND is_cohost = true
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Verificar cupos contando jugadores registrados + invitados externos
  IF (
    (SELECT COUNT(*) FROM public.match_players WHERE match_id = v_match_id) +
    (SELECT COUNT(*) FROM public.match_guests   WHERE match_id = v_match_id)
  ) >= (SELECT total_spots FROM public.matches WHERE id = v_match_id) THEN
    RAISE EXCEPTION 'El partido está completo';
  END IF;

  UPDATE public.match_requests SET status = 'accepted' WHERE id = p_request_id;

  INSERT INTO public.match_players (match_id, player_id)
  VALUES (v_match_id, v_player_id)
  ON CONFLICT (match_id, player_id) DO NOTHING;
END;
$$;
