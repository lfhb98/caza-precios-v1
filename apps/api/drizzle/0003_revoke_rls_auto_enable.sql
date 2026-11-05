-- `public.rls_auto_enable()` la crea Supabase al activar "RLS automático" y la usa
-- el event trigger `ensure_rls`. Por estar en `public`, la API REST la expone como
-- /rest/v1/rpc/rls_auto_enable para anon y authenticated (aviso 0028/0029 del
-- linter de Supabase). El event trigger no necesita esos permisos.
-- Solo si existe: en otros entornos (tests con PGlite) no está.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END
$$;
