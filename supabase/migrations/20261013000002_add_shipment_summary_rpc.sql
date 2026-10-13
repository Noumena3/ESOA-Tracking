CREATE OR REPLACE FUNCTION public.get_shipment_summary(
  p_search text DEFAULT '',
  p_username text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  total_count bigint,
  arrived_count bigint,
  transit_count bigint,
  collected_count bigint,
  total_frais bigint,
  arrived_frais bigint,
  collected_frais bigint,
  transit_frais bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE s.status = 'Arrivé')::bigint,
    COUNT(*) FILTER (WHERE s.status = 'En transit')::bigint,
    COUNT(*) FILTER (WHERE s.status = 'Récupéré')::bigint,
    COALESCE(SUM(s.frais), 0)::bigint,
    COALESCE(SUM(s.frais) FILTER (WHERE s.status = 'Arrivé'), 0)::bigint,
    COALESCE(SUM(s.frais) FILTER (WHERE s.status = 'Récupéré'), 0)::bigint,
    COALESCE(SUM(s.frais) FILTER (WHERE s.status = 'En transit'), 0)::bigint
  FROM public.shipments AS s
  WHERE (
    COALESCE(p_search, '') = ''
    OR POSITION(LOWER(p_search) IN LOWER(s.id)) > 0
    OR POSITION(LOWER(p_search) IN LOWER(s.article)) > 0
  )
    AND (p_username IS NULL OR s.username = p_username)
    AND (p_status IS NULL OR s.status = p_status);
$$;

REVOKE ALL ON FUNCTION public.get_shipment_summary(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shipment_summary(text, text, text) TO authenticated;
