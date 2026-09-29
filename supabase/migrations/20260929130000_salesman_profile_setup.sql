-- Salesman profile setup: name, photo path, language, and a completion timestamp.
-- Does not add a second profile or auth system.
-- Role, mobile, is_active, and employment stay off this function.
-- Profile photos reuse the private salesman-media bucket at {auth.uid}/profile.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS profile_setup_completed_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_language_known;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_language_known
  CHECK (preferred_language IN ('en', 'hi'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_avatar_path_own;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_path_own
  CHECK (
    avatar_path IS NULL
    OR avatar_path = (id::text || '/profile')
  );

COMMENT ON COLUMN public.profiles.avatar_path IS
  'Private salesman-media object {profile id}/profile. Null when no photo is saved.';
COMMENT ON COLUMN public.profiles.preferred_language IS
  'Sales app language preference. en or hi. The app copy is not translated yet.';
COMMENT ON COLUMN public.profiles.profile_setup_completed_at IS
  'Set when the salesman finishes first-time setup. Null means setup is still required.';

-- Shop folders stay limited to assigned shops.
-- A profile photo is the object {uid}/profile, not a shop folder.
CREATE OR REPLACE FUNCTION public.salesman_media_object_allowed(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, storage
AS $$
  SELECT
    public.profile_has_role('SALESMAN')
    AND (storage.foldername(p_name))[1] = auth.uid()::text
    AND (
      (
        storage.filename(p_name) = 'profile'
        AND coalesce(array_length(storage.foldername(p_name), 1), 0) = 1
      )
      OR (
        (storage.foldername(p_name))[2]
          ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND (storage.foldername(p_name))[2]::uuid IN (SELECT public.salesman_shop_ids())
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.salesman_update_own_profile(
  p_display_name text,
  p_preferred_language text,
  p_update_avatar boolean DEFAULT false,
  p_avatar_path text DEFAULT NULL,
  p_complete_setup boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_language text;
  v_avatar text;
  v_row public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_salesman_profile(v_uid) THEN
    RAISE EXCEPTION 'SALESMAN role required';
  END IF;

  SELECT * INTO v_row
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  IF NOT v_row.is_active THEN
    RAISE EXCEPTION 'This account is not active';
  END IF;

  v_name := btrim(COALESCE(p_display_name, ''));
  IF char_length(v_name) < 1 OR char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'Enter a name up to 80 characters';
  END IF;

  v_language := lower(btrim(COALESCE(p_preferred_language, '')));
  IF v_language NOT IN ('en', 'hi') THEN
    RAISE EXCEPTION 'Preferred language is not supported';
  END IF;

  IF p_update_avatar THEN
    v_avatar := NULLIF(btrim(COALESCE(p_avatar_path, '')), '');
    IF v_avatar IS NOT NULL AND v_avatar IS DISTINCT FROM (v_uid::text || '/profile') THEN
      RAISE EXCEPTION 'Profile photo path is not allowed';
    END IF;
  ELSE
    v_avatar := v_row.avatar_path;
  END IF;

  UPDATE public.profiles
  SET
    display_name = v_name,
    preferred_language = v_language,
    avatar_path = v_avatar,
    profile_setup_completed_at = CASE
      WHEN p_complete_setup THEN COALESCE(profile_setup_completed_at, now())
      ELSE profile_setup_completed_at
    END
  WHERE id = v_uid
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'displayName', v_row.display_name,
    'preferredLanguage', v_row.preferred_language,
    'avatarPath', v_row.avatar_path,
    'profileSetupCompletedAt', v_row.profile_setup_completed_at,
    'mobile', v_row.mobile,
    'roles', v_row.roles,
    'isActive', v_row.is_active
  );
END;
$$;

REVOKE ALL ON FUNCTION public.salesman_update_own_profile(text, text, boolean, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salesman_update_own_profile(text, text, boolean, text, boolean) TO authenticated;

COMMENT ON FUNCTION public.salesman_update_own_profile IS
  'Salesman updates only their name, preferred language, and profile photo path. Role, mobile, is_active, and employment are not parameters.';
