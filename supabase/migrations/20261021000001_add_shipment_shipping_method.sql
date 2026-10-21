-- Classifies new shipments so transit alerts can use the correct delivery window.
-- Existing shipments stay NULL until their shipping method is known.
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS shipping_method text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.shipments'::regclass
      AND conname = 'shipments_shipping_method_allowed_check'
  ) THEN
    ALTER TABLE public.shipments
      ADD CONSTRAINT shipments_shipping_method_allowed_check
      CHECK (shipping_method IS NULL OR shipping_method IN ('Normal', 'Maritime'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.shipments.shipping_method IS
  'Shipping mode: Normal (air) or Maritime. NULL means legacy shipment not yet classified.';
