-- Perfil automático al registrarse un usuario en Supabase Auth.
-- Usa el `username` de los metadatos de registro si está libre; si no, uno generado.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  wanted text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  fallback text := 'usuario_' || left(replace(new.id::text, '-', ''), 12);
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, coalesce(wanted, fallback))
  ON CONFLICT (username) DO NOTHING;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, username) VALUES (new.id, fallback);
  END IF;

  RETURN new;
END;
$$;
--> statement-breakpoint
-- Solo debe ejecutarla el trigger, nunca un cliente.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--> statement-breakpoint
-- Usuarios que ya existían antes de esta migración.
INSERT INTO public.profiles (id, username)
SELECT id, 'usuario_' || left(replace(id::text, '-', ''), 12)
FROM auth.users
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Tiendas precargadas (DEFAULT_STORES de @caza-precios/shared).
INSERT INTO public.stores (name, is_default) VALUES
  ('Mercadona', true),
  ('Carrefour', true),
  ('Consum', true),
  ('Lidl', true),
  ('Dia', true),
  ('Alcampo', true),
  ('Eroski', true)
ON CONFLICT DO NOTHING;
