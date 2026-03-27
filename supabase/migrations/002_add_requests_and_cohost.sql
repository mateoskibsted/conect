-- ============================================================
-- Migración 002: Solicitudes de unión + co-hosts
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar columna is_cohost a match_players
ALTER TABLE public.match_players
  ADD COLUMN IF NOT EXISTS is_cohost boolean NOT NULL DEFAULT false;

-- 2. Nueva tabla: match_requests
CREATE TABLE IF NOT EXISTS public.match_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (match_id, player_id)
);

ALTER TABLE public.match_requests ENABLE ROW LEVEL SECURITY;

-- El jugador puede ver sus propias solicitudes
-- El host (creador) y co-hosts pueden ver todas las solicitudes de sus partidos
CREATE POLICY "match_requests: lectura"
  ON public.match_requests FOR SELECT
  USING (
    player_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.matches
      WHERE id = match_requests.match_id AND creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.match_players
      WHERE match_id = match_requests.match_id
        AND player_id = auth.uid()
        AND is_cohost = true
    )
  );

-- Solo el propio usuario puede crear una solicitud para sí mismo
CREATE POLICY "match_requests: insertar"
  ON public.match_requests FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- Solo el host y co-hosts pueden actualizar el estado de una solicitud
CREATE POLICY "match_requests: actualizar"
  ON public.match_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE id = match_requests.match_id AND creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.match_players
      WHERE match_id = match_requests.match_id
        AND player_id = auth.uid()
        AND is_cohost = true
    )
  );

-- El jugador puede retirar su propia solicitud
CREATE POLICY "match_requests: retirar"
  ON public.match_requests FOR DELETE
  USING (auth.uid() = player_id);

-- 3. Política UPDATE para match_players (para asignar co-host)
--    Solo el creador del partido puede actualizar roles
CREATE POLICY "match_players: actualizar"
  ON public.match_players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE id = match_players.match_id AND creator_id = auth.uid()
    )
  );

-- 4. Función RPC: aceptar solicitud (SECURITY DEFINER para poder insertar
--    en match_players sin importar el RLS del jugador)
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
  -- Obtener datos de la solicitud
  SELECT match_id, player_id INTO v_match_id, v_player_id
  FROM public.match_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada o ya procesada';
  END IF;

  -- Verificar que quien llama es creator o co-host
  IF NOT EXISTS (
    SELECT 1 FROM public.matches WHERE id = v_match_id AND creator_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.match_players
    WHERE match_id = v_match_id AND player_id = auth.uid() AND is_cohost = true
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Verificar que el partido no está lleno
  IF (
    SELECT COUNT(*) FROM public.match_players WHERE match_id = v_match_id
  ) >= (
    SELECT total_spots FROM public.matches WHERE id = v_match_id
  ) THEN
    RAISE EXCEPTION 'El partido está completo';
  END IF;

  -- Marcar solicitud como aceptada
  UPDATE public.match_requests SET status = 'accepted' WHERE id = p_request_id;

  -- Agregar jugador al partido
  INSERT INTO public.match_players (match_id, player_id)
  VALUES (v_match_id, v_player_id)
  ON CONFLICT (match_id, player_id) DO NOTHING;
END;
$$;

-- 5. Función RPC: asignar/quitar co-host (solo el creator puede hacerlo)
CREATE OR REPLACE FUNCTION public.set_cohost(p_match_id uuid, p_player_id uuid, p_value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.matches WHERE id = p_match_id AND creator_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.match_players
  SET is_cohost = p_value
  WHERE match_id = p_match_id AND player_id = p_player_id;
END;
$$;
