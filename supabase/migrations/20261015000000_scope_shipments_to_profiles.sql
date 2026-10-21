-- Profile-based authorization. Only explicitly provisioned Supabase users can access the app.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  username text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.profiles FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.profiles TO authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

INSERT INTO public.profiles (id, username, role)
VALUES ('e7b096fa-c5f3-4028-a3b2-1354db33fa03', 'Noumena', 'admin')
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, role = 'admin';

CREATE OR REPLACE FUNCTION public.is_esoa_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_esoa_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_esoa_admin() TO authenticated;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
UPDATE public.shipments
SET owner_id = 'e7b096fa-c5f3-4028-a3b2-1354db33fa03'
WHERE owner_id IS NULL;
ALTER TABLE public.shipments
  ALTER COLUMN owner_id SET DEFAULT auth.uid(),
  ALTER COLUMN owner_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS shipments_owner_id_idx ON public.shipments(owner_id);

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
UPDATE public.audit_logs AS a
SET owner_id = s.owner_id
FROM public.shipments AS s
WHERE a.shipment_id = s.id AND a.owner_id IS NULL;
UPDATE public.audit_logs
SET owner_id = 'e7b096fa-c5f3-4028-a3b2-1354db33fa03'
WHERE owner_id IS NULL;
ALTER TABLE public.audit_logs ALTER COLUMN owner_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS audit_logs_owner_shipment_created_idx
  ON public.audit_logs(owner_id, shipment_id, created_at DESC);

-- Start with a clean policy set so an older permissive policy cannot override ownership.
DO $$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('profiles', 'shipments', 'audit_logs')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  END LOOP;
END;
$$;

CREATE POLICY "Users can read their own profile; admins can read all"
ON public.profiles FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) OR (SELECT public.is_esoa_admin()));

REVOKE ALL ON TABLE public.shipments FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shipments TO authenticated;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own shipments; admins can read all"
ON public.shipments FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()) OR (SELECT public.is_esoa_admin()));

CREATE POLICY "Users can create their own shipments; admins can create all"
ON public.shipments FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.is_esoa_admin())
  OR (
    owner_id = (SELECT auth.uid())
    AND username = (SELECT p.username FROM public.profiles AS p WHERE p.id = (SELECT auth.uid()))
  )
);

CREATE POLICY "Users can update their own shipments; admins can update all"
ON public.shipments FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()) OR (SELECT public.is_esoa_admin()))
WITH CHECK (
  (SELECT public.is_esoa_admin())
  OR (
    owner_id = (SELECT auth.uid())
    AND username = (SELECT p.username FROM public.profiles AS p WHERE p.id = (SELECT auth.uid()))
  )
);

CREATE POLICY "Users can delete their own shipments; admins can delete all"
ON public.shipments FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid()) OR (SELECT public.is_esoa_admin()));

REVOKE ALL ON TABLE public.audit_logs FROM anon, authenticated, PUBLIC;
REVOKE ALL ON SEQUENCE public.audit_logs_id_seq FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own shipment history; admins can read all"
ON public.audit_logs FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()) OR (SELECT public.is_esoa_admin()));

-- When an admin later provisions Eric or Mika, existing rows and their history
-- with that username move to the newly linked account automatically.
CREATE OR REPLACE FUNCTION public.assign_existing_shipments_to_new_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role = 'staff' THEN
    UPDATE public.shipments
    SET owner_id = NEW.id
    WHERE username = NEW.username
      AND owner_id = 'e7b096fa-c5f3-4028-a3b2-1354db33fa03';

    UPDATE public.audit_logs AS a
    SET owner_id = NEW.id
    FROM public.shipments AS s
    WHERE a.shipment_id = s.id
      AND s.owner_id = NEW.id
      AND a.owner_id = 'e7b096fa-c5f3-4028-a3b2-1354db33fa03';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_existing_shipments_to_new_staff() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER assign_existing_shipments_to_new_staff
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_existing_shipments_to_new_staff();

-- Store audit events in the same database transaction as the shipment change.
CREATE OR REPLACE FUNCTION public.log_shipment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_name text;
  shipment_owner uuid;
BEGIN
  SELECT p.username INTO actor_name
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid());
  actor_name := COALESCE(actor_name, 'Administration');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (shipment_id, action, username, details, owner_id, actor_id)
    VALUES (NEW.id, 'CREATE', actor_name, jsonb_build_object('article', NEW.article), NEW.owner_id, (SELECT auth.uid()));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (shipment_id, action, username, details, owner_id, actor_id)
    VALUES (OLD.id, 'DELETE', actor_name, jsonb_build_object('article', OLD.article, 'status', OLD.status), OLD.owner_id, (SELECT auth.uid()));
    RETURN OLD;
  END IF;

  shipment_owner := NEW.owner_id;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_logs (shipment_id, action, username, details, owner_id, actor_id)
    VALUES (NEW.id, 'STATUS_CHANGE', actor_name, jsonb_build_object('old', OLD.status, 'new', NEW.status), shipment_owner, (SELECT auth.uid()));
  END IF;
  IF OLD.frais IS DISTINCT FROM NEW.frais THEN
    INSERT INTO public.audit_logs (shipment_id, action, username, details, owner_id, actor_id)
    VALUES (NEW.id, 'FRAIS_CHANGE', actor_name, jsonb_build_object('oldValue', OLD.frais, 'newValue', NEW.frais), shipment_owner, (SELECT auth.uid()));
  END IF;
  IF OLD.article IS DISTINCT FROM NEW.article THEN
    INSERT INTO public.audit_logs (shipment_id, action, username, details, owner_id, actor_id)
    VALUES (NEW.id, 'ARTICLE_CHANGE', actor_name, jsonb_build_object('old', OLD.article, 'new', NEW.article), shipment_owner, (SELECT auth.uid()));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.log_shipment_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS shipments_audit_change ON public.shipments;
CREATE TRIGGER shipments_audit_change
AFTER INSERT OR UPDATE OR DELETE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.log_shipment_change();
