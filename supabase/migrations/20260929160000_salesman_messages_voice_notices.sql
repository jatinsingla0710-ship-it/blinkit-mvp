-- Phase 7B field tools. Messages, voice notes, in-app notices, and push
-- subscription storage. Does not change orders, stock, payments, commission,
-- attendance, visits, or claim approval effects.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg'
]
WHERE id = 'salesman-media';

CREATE TABLE IF NOT EXISTS public.salesman_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesman_profile_id uuid NOT NULL REFERENCES public.profiles (id),
  sender_profile_id uuid NOT NULL REFERENCES public.profiles (id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salesman_messages_body_length CHECK (
    char_length(btrim(body)) BETWEEN 1 AND 1000
  )
);

CREATE INDEX IF NOT EXISTS salesman_messages_thread_idx
  ON public.salesman_messages (salesman_profile_id, created_at);

CREATE TABLE IF NOT EXISTS public.salesman_voice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesman_profile_id uuid NOT NULL REFERENCES public.profiles (id),
  shop_id uuid NOT NULL REFERENCES public.shops (id),
  visit_id uuid REFERENCES public.sales_visits (id),
  audio_path text,
  duration_seconds integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salesman_voice_notes_duration CHECK (
    duration_seconds > 0 AND duration_seconds <= 120
  ),
  CONSTRAINT salesman_voice_notes_audio_path CHECK (
    audio_path IS NULL
    OR audio_path = (
      salesman_profile_id::text || '/' || shop_id::text || '/voice/' || id::text
    )
  )
);

CREATE INDEX IF NOT EXISTS salesman_voice_notes_owner_idx
  ON public.salesman_voice_notes (salesman_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.salesman_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id uuid NOT NULL REFERENCES public.profiles (id),
  title text NOT NULL,
  body text NOT NULL,
  href text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salesman_notices_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  CONSTRAINT salesman_notices_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 500)
);

CREATE INDEX IF NOT EXISTS salesman_notices_recipient_idx
  ON public.salesman_notices (recipient_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.salesman_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesman_profile_id uuid NOT NULL REFERENCES public.profiles (id),
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salesman_push_subscriptions_endpoint_length CHECK (
    char_length(endpoint) BETWEEN 8 AND 500
  ),
  CONSTRAINT salesman_push_subscriptions_owner_endpoint UNIQUE (salesman_profile_id, endpoint)
);

ALTER TABLE public.salesman_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_voice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_voice_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_notices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_push_subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salesman_messages_select ON public.salesman_messages;
CREATE POLICY salesman_messages_select
  ON public.salesman_messages
  FOR SELECT TO authenticated
  USING (public.is_admin() OR salesman_profile_id = auth.uid());

DROP POLICY IF EXISTS salesman_messages_admin_write ON public.salesman_messages;
CREATE POLICY salesman_messages_admin_write
  ON public.salesman_messages
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS salesman_voice_notes_select ON public.salesman_voice_notes;
CREATE POLICY salesman_voice_notes_select
  ON public.salesman_voice_notes
  FOR SELECT TO authenticated
  USING (public.is_admin() OR salesman_profile_id = auth.uid());

DROP POLICY IF EXISTS salesman_voice_notes_admin_write ON public.salesman_voice_notes;
CREATE POLICY salesman_voice_notes_admin_write
  ON public.salesman_voice_notes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS salesman_notices_select ON public.salesman_notices;
CREATE POLICY salesman_notices_select
  ON public.salesman_notices
  FOR SELECT TO authenticated
  USING (recipient_profile_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS salesman_notices_admin_write ON public.salesman_notices;
CREATE POLICY salesman_notices_admin_write
  ON public.salesman_notices
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS salesman_push_subscriptions_select ON public.salesman_push_subscriptions;
CREATE POLICY salesman_push_subscriptions_select
  ON public.salesman_push_subscriptions
  FOR SELECT TO authenticated
  USING (salesman_profile_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS salesman_push_subscriptions_admin_write ON public.salesman_push_subscriptions;
CREATE POLICY salesman_push_subscriptions_admin_write
  ON public.salesman_push_subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salesman_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salesman_voice_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salesman_notices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salesman_push_subscriptions TO authenticated;
GRANT ALL ON public.salesman_messages TO service_role;
GRANT ALL ON public.salesman_voice_notes TO service_role;
GRANT ALL ON public.salesman_notices TO service_role;
GRANT ALL ON public.salesman_push_subscriptions TO service_role;

CREATE OR REPLACE FUNCTION public._salesman_add_notice(
  p_profile uuid,
  p_title text,
  p_body text,
  p_href text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.salesman_notices (recipient_profile_id, title, body, href)
  VALUES (p_profile, left(btrim(p_title), 120), left(btrim(p_body), 500), NULLIF(btrim(COALESCE(p_href, '')), ''));

  INSERT INTO public.notification_outbox (channel, template_key, recipient, payload)
  VALUES (
    'PUSH',
    'salesman_notice',
    p_profile::text,
    jsonb_build_object(
      'title', left(btrim(p_title), 120),
      'body', left(btrim(p_body), 500),
      'url', COALESCE(NULLIF(btrim(COALESCE(p_href, '')), ''), '/profile/notices')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public._salesman_add_notice(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._salesman_add_notice(uuid, text, text, text) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public._salesman_notice_on_claim_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body text;
  v_href text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status <> 'PENDING'::public.salesman_claim_status THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'salesman_expenses' THEN
    v_title := 'Expense ' || lower(NEW.status::text);
    v_body := COALESCE(NEW.review_note, 'Your expense was reviewed.');
    v_href := '/profile/expenses/' || NEW.id::text;
  ELSE
    v_title := 'Return ' || lower(NEW.status::text);
    v_body := COALESCE(NEW.review_note, 'Your return request was reviewed.');
    v_href := '/profile/returns/' || NEW.id::text;
  END IF;
  PERFORM public._salesman_add_notice(NEW.salesman_profile_id, v_title, v_body, v_href);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_salesman_expenses_notice ON public.salesman_expenses;
CREATE TRIGGER trg_salesman_expenses_notice
  AFTER UPDATE ON public.salesman_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public._salesman_notice_on_claim_review();

DROP TRIGGER IF EXISTS trg_salesman_return_requests_notice ON public.salesman_return_requests;
CREATE TRIGGER trg_salesman_return_requests_notice
  AFTER UPDATE ON public.salesman_return_requests
  FOR EACH ROW
  EXECUTE FUNCTION public._salesman_notice_on_claim_review();

CREATE OR REPLACE FUNCTION public.salesman_send_message(p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._salesman_require_self();
  v_body text := btrim(COALESCE(p_body, ''));
  v_row public.salesman_messages;
BEGIN
  IF char_length(v_body) < 1 OR char_length(v_body) > 1000 THEN
    RAISE EXCEPTION 'Enter a message up to 1000 characters';
  END IF;
  INSERT INTO public.salesman_messages (salesman_profile_id, sender_profile_id, body)
  VALUES (v_uid, v_uid, v_body)
  RETURNING * INTO v_row;
  RETURN jsonb_build_object(
    'id', v_row.id,
    'salesmanProfileId', v_row.salesman_profile_id,
    'senderProfileId', v_row.sender_profile_id,
    'body', v_row.body,
    'createdAt', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_send_salesman_message(
  p_salesman_id uuid,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_body text := btrim(COALESCE(p_body, ''));
  v_row public.salesman_messages;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_salesman_id IS NULL OR NOT public.is_salesman_profile(p_salesman_id) THEN
    RAISE EXCEPTION 'Choose a salesman';
  END IF;
  IF char_length(v_body) < 1 OR char_length(v_body) > 1000 THEN
    RAISE EXCEPTION 'Enter a message up to 1000 characters';
  END IF;
  INSERT INTO public.salesman_messages (salesman_profile_id, sender_profile_id, body)
  VALUES (p_salesman_id, auth.uid(), v_body)
  RETURNING * INTO v_row;
  PERFORM public._salesman_add_notice(
    p_salesman_id,
    'New message',
    v_body,
    '/profile/messages'
  );
  RETURN jsonb_build_object(
    'id', v_row.id,
    'salesmanProfileId', v_row.salesman_profile_id,
    'senderProfileId', v_row.sender_profile_id,
    'body', v_row.body,
    'createdAt', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.salesman_create_voice_note(
  p_shop_id uuid,
  p_visit_id uuid,
  p_duration_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._salesman_require_self();
  v_row public.salesman_voice_notes;
BEGIN
  IF p_shop_id IS NULL OR p_shop_id NOT IN (SELECT public.salesman_shop_ids()) THEN
    RAISE EXCEPTION 'This shop is not assigned to you';
  END IF;
  IF p_duration_seconds IS NULL OR p_duration_seconds <= 0 OR p_duration_seconds > 120 THEN
    RAISE EXCEPTION 'Record between 1 and 120 seconds';
  END IF;
  IF p_visit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sales_visits v
    WHERE v.id = p_visit_id
      AND v.salesman_profile_id = v_uid
      AND v.shop_id = p_shop_id
  ) THEN
    RAISE EXCEPTION 'That visit is not yours';
  END IF;
  INSERT INTO public.salesman_voice_notes (
    salesman_profile_id, shop_id, visit_id, duration_seconds
  ) VALUES (
    v_uid, p_shop_id, p_visit_id, p_duration_seconds
  )
  RETURNING * INTO v_row;
  RETURN jsonb_build_object(
    'id', v_row.id,
    'salesmanProfileId', v_row.salesman_profile_id,
    'shopId', v_row.shop_id,
    'visitId', v_row.visit_id,
    'audioPath', v_row.audio_path,
    'durationSeconds', v_row.duration_seconds,
    'createdAt', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.salesman_set_voice_note_path(
  p_note_id uuid,
  p_audio_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._salesman_require_self();
  v_row public.salesman_voice_notes;
  v_path text;
BEGIN
  SELECT salesman_profile_id::text || '/' || shop_id::text || '/voice/' || id::text
  INTO v_path
  FROM public.salesman_voice_notes
  WHERE id = p_note_id AND salesman_profile_id = v_uid;
  IF v_path IS NULL OR p_audio_path IS DISTINCT FROM v_path THEN
    RAISE EXCEPTION 'Voice note path is not allowed';
  END IF;
  UPDATE public.salesman_voice_notes
  SET audio_path = v_path
  WHERE id = p_note_id AND salesman_profile_id = v_uid AND audio_path IS NULL
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This voice note already has audio';
  END IF;
  RETURN jsonb_build_object(
    'id', v_row.id,
    'shopId', v_row.shop_id,
    'visitId', v_row.visit_id,
    'audioPath', v_row.audio_path,
    'durationSeconds', v_row.duration_seconds,
    'createdAt', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.salesman_save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._salesman_require_self();
BEGIN
  IF p_endpoint IS NULL OR char_length(btrim(p_endpoint)) < 8 THEN
    RAISE EXCEPTION 'Push endpoint is not valid';
  END IF;
  INSERT INTO public.salesman_push_subscriptions (
    salesman_profile_id, endpoint, p256dh, auth_key
  ) VALUES (
    v_uid, btrim(p_endpoint), btrim(COALESCE(p_p256dh, '')), btrim(COALESCE(p_auth_key, ''))
  )
  ON CONFLICT (salesman_profile_id, endpoint)
  DO UPDATE SET p256dh = EXCLUDED.p256dh, auth_key = EXCLUDED.auth_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.salesman_mark_notice_read(p_notice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public._salesman_require_self();
BEGIN
  UPDATE public.salesman_notices
  SET read_at = COALESCE(read_at, now())
  WHERE id = p_notice_id AND recipient_profile_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.salesman_send_message(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_send_salesman_message(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salesman_create_voice_note(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salesman_set_voice_note_path(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salesman_save_push_subscription(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salesman_mark_notice_read(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.salesman_send_message(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_salesman_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salesman_create_voice_note(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salesman_set_voice_note_path(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salesman_save_push_subscription(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salesman_mark_notice_read(uuid) TO authenticated;

COMMENT ON TABLE public.salesman_messages IS
  'Text thread between one salesman and admins. Does not change orders or payments.';
COMMENT ON TABLE public.salesman_voice_notes IS
  'Optional audio attached to a shop or visit. Does not change the visit outcome.';
COMMENT ON TABLE public.salesman_notices IS
  'In-app alerts. Browser delivery still depends on a configured push sender.';
