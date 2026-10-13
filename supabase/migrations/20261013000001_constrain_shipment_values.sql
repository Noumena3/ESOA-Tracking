DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.shipments'::regclass
      AND conname = 'shipments_frais_nonnegative_check'
  ) THEN
    ALTER TABLE public.shipments
      ADD CONSTRAINT shipments_frais_nonnegative_check CHECK (frais >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.shipments'::regclass
      AND conname = 'shipments_status_allowed_check'
  ) THEN
    ALTER TABLE public.shipments
      ADD CONSTRAINT shipments_status_allowed_check
      CHECK (status IN ('En transit', 'Arrivé', 'Récupéré'));
  END IF;
END;
$$;
