REVOKE ALL ON TABLE public.audit_logs FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;

CREATE POLICY "Authenticated users can read audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (true);
