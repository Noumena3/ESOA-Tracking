BEGIN;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS transit_since timestamptz;

-- Reconstitue la dernière entrée en transit depuis l'historique disponible.
-- Pour les dossiers sans événement, la date d'ajout sert de point de départ.
UPDATE public.shipments AS shipment
SET transit_since = COALESCE(
  (
    SELECT log.created_at
    FROM public.audit_logs AS log
    WHERE log.shipment_id = shipment.id
      AND log.action = 'STATUS_CHANGE'
      AND COALESCE(
        log.details ->> 'newValue',
        log.details ->> 'new',
        log.details ->> 'newStatus'
      ) = 'En transit'
    ORDER BY log.created_at DESC, log.id DESC
    LIMIT 1
  ),
  shipment.created_at
)
WHERE shipment.status = 'En transit';

UPDATE public.shipments
SET transit_since = NULL
WHERE status <> 'En transit';

CREATE INDEX IF NOT EXISTS shipments_status_transit_since_idx
  ON public.shipments(status, transit_since);

CREATE OR REPLACE FUNCTION public.set_shipment_transit_since()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'En transit' THEN
      NEW.transit_since := COALESCE(NEW.transit_since, NEW.created_at, now());
    ELSE
      NEW.transit_since := NULL;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'En transit' THEN
      NEW.transit_since := now();
    ELSE
      NEW.transit_since := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS init_shipment_transit_since ON public.shipments;
CREATE TRIGGER init_shipment_transit_since
BEFORE INSERT ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.set_shipment_transit_since();

DROP TRIGGER IF EXISTS track_shipment_transit_since ON public.shipments;
CREATE TRIGGER track_shipment_transit_since
BEFORE UPDATE OF status ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.set_shipment_transit_since();

COMMIT;
