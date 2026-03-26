-- =============================================================================
-- EXECUTAR NO SUPABASE: SQL Editor > New query
-- =============================================================================


-- 1. TRIGGER: cria registro em "User" quando um novo usuário é criado no Supabase Auth
--    Substitui o webhook user.created do Clerk.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public."User" (id, email, name)
  VALUES (
    NEW.id::text,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.email,
      ''
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      name  = COALESCE(EXCLUDED.name, public."User".name);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- 2. CUSTOM ACCESS TOKEN HOOK: injeta organization_id e role no JWT
--    Ativa em: Authentication > Hooks > Custom Access Token
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims       jsonb;
  v_user_id    text;
  v_org_id     text;
  v_role       text;
BEGIN
  claims    := event -> 'claims';
  v_user_id := event ->> 'user_id';

  SELECT "organizationId", role
  INTO   v_org_id, v_role
  FROM   public."OrganizationMember"
  WHERE  "userId" = v_user_id
  LIMIT  1;

  IF v_org_id IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims -> 'app_metadata', '{}'::jsonb)
        || jsonb_build_object('organization_id', v_org_id, 'role', v_role)
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Permissões obrigatórias para o hook funcionar
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Permissão de leitura para o auth_admin consultar a tabela de membros
GRANT SELECT ON public."OrganizationMember" TO supabase_auth_admin;
