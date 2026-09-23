import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createServiceClient, createUserClient } from '../_shared/supabase.ts';
import { logEvent } from '../_shared/log.ts';

/**
 * Provision a salesman for Sales PWA login.
 * - Caller JWT required (gateway verify_jwt=true) + is_admin()
 * - Service role used only inside this function for Auth Admin + profile upsert
 * - Never expose service-role key to the browser
 *
 * Body: { displayName, mobile, email, temporaryPassword, isActive? }
 */
type Body = {
  displayName?: string;
  mobile?: string;
  email?: string;
  temporaryPassword?: string;
  isActive?: boolean;
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse(req);
  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405);
  }

  const started = Date.now();
  const service = createServiceClient();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse(req, { error: 'Authorization required' }, 401);
    }

    const userClient = createUserClient(authHeader);
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return jsonResponse(req, { error: 'Invalid session' }, 401);
    }

    const { data: isAdmin, error: adminErr } = await userClient.rpc('is_admin');
    if (adminErr) {
      return jsonResponse(req, { error: adminErr.message }, 500);
    }
    if (!isAdmin) {
      return jsonResponse(req, { error: 'Admin role required' }, 403);
    }

    const body = (await req.json()) as Body;
    const displayName = String(body.displayName ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const temporaryPassword = String(body.temporaryPassword ?? '');
    const isActive = body.isActive !== false;

    if (!displayName) {
      return jsonResponse(req, { error: 'displayName is required' }, 400);
    }
    if (!isEmail(email)) {
      return jsonResponse(req, { error: 'Valid email is required' }, 400);
    }
    if (temporaryPassword.length < 8 || temporaryPassword.length > 72) {
      return jsonResponse(
        req,
        { error: 'temporaryPassword must be 8–72 characters' },
        400,
      );
    }

    const { data: normalizedMobile, error: mobileErr } = await service.rpc(
      'normalize_mobile',
      { p_mobile: String(body.mobile ?? '') },
    );
    if (mobileErr || !normalizedMobile) {
      return jsonResponse(
        req,
        { error: mobileErr?.message ?? 'Invalid mobile number' },
        400,
      );
    }
    const mobile = String(normalizedMobile);

    // --- Idempotency / conflict checks on profile mobile ---
    const { data: byMobile, error: byMobileErr } = await service
      .from('profiles')
      .select('id, roles, is_active, deleted_at, display_name, mobile')
      .eq('mobile', mobile)
      .is('deleted_at', null)
      .maybeSingle();
    if (byMobileErr) {
      return jsonResponse(req, { error: byMobileErr.message }, 500);
    }

    if (byMobile) {
      const roles = (byMobile.roles ?? []) as string[];
      if (roles.includes('SALESMAN')) {
        return jsonResponse(req, {
          profileId: byMobile.id,
          authUserId: byMobile.id,
          email,
          displayName: byMobile.display_name,
          mobile: byMobile.mobile,
          alreadyProvisioned: true,
          createdAuthUser: false,
        });
      }
      return jsonResponse(
        req,
        {
          error:
            'A profile already exists for this mobile without SALESMAN role',
          code: 'MOBILE_PROFILE_CONFLICT',
          profileId: byMobile.id,
        },
        409,
      );
    }

    // --- Find existing Auth user by email (paginate lightly) ---
    let existingAuthUserId: string | null = null;
    {
      let page = 1;
      const perPage = 200;
      while (page <= 5 && !existingAuthUserId) {
        const { data: listed, error: listErr } =
          await service.auth.admin.listUsers({ page, perPage });
        if (listErr) {
          return jsonResponse(req, { error: listErr.message }, 500);
        }
        const match = (listed.users ?? []).find(
          (u) => (u.email ?? '').toLowerCase() === email,
        );
        if (match) {
          existingAuthUserId = match.id;
          break;
        }
        if ((listed.users?.length ?? 0) < perPage) break;
        page += 1;
      }
    }

    if (existingAuthUserId) {
      const { data: existingProfile, error: existingProfileErr } = await service
        .from('profiles')
        .select('id, roles, is_active, deleted_at, display_name, mobile')
        .eq('id', existingAuthUserId)
        .maybeSingle();
      if (existingProfileErr) {
        return jsonResponse(req, { error: existingProfileErr.message }, 500);
      }

      if (existingProfile && existingProfile.deleted_at == null) {
        const roles = (existingProfile.roles ?? []) as string[];
        if (roles.includes('SALESMAN')) {
          return jsonResponse(req, {
            profileId: existingProfile.id,
            authUserId: existingProfile.id,
            email,
            displayName: existingProfile.display_name,
            mobile: existingProfile.mobile,
            alreadyProvisioned: true,
            createdAuthUser: false,
          });
        }
        return jsonResponse(
          req,
          {
            error:
              'Auth user email is already linked to a non-SALESMAN profile',
            code: 'EMAIL_PROFILE_CONFLICT',
            profileId: existingProfile.id,
          },
          409,
        );
      }

      // Auth user exists without profile — attach SALESMAN profile (no new auth).
      const { error: insertErr } = await service.from('profiles').insert({
        id: existingAuthUserId,
        display_name: displayName,
        mobile,
        roles: ['SALESMAN'],
        is_active: isActive,
      });
      if (insertErr) {
        const msg = insertErr.message ?? 'Failed to create salesman profile';
        const code = msg.toLowerCase().includes('mobile')
          ? 'MOBILE_PROFILE_CONFLICT'
          : 'PROFILE_CREATE_FAILED';
        return jsonResponse(req, { error: msg, code }, 409);
      }

      await service.rpc('write_audit_log', {
        p_action: 'salesman.provisioned_admin',
        p_entity_type: 'profile',
        p_entity_id: existingAuthUserId,
        p_payload: {
          email,
          mobile,
          linkedExistingAuthUser: true,
        },
        p_actor_profile_id: user.id,
        p_actor_role: 'ADMIN',
      });

      await logEvent(service, {
        level: 'info',
        source: 'provision-salesman',
        message: 'Linked SALESMAN profile to existing auth user',
        context: { profileId: existingAuthUserId, email },
        durationMs: Date.now() - started,
      });

      return jsonResponse(req, {
        profileId: existingAuthUserId,
        authUserId: existingAuthUserId,
        email,
        displayName,
        mobile,
        alreadyProvisioned: false,
        createdAuthUser: false,
        temporaryPasswordSet: false,
      });
    }

    // --- Create Auth user + profile ---
    const { data: created, error: createErr } =
      await service.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          role: 'SALESMAN',
        },
      });

    if (createErr || !created.user) {
      const msg = createErr?.message ?? 'Could not create auth user';
      const lower = msg.toLowerCase();
      const code =
        lower.includes('already') || lower.includes('registered')
          ? 'EMAIL_AUTH_CONFLICT'
          : 'AUTH_CREATE_FAILED';
      return jsonResponse(req, { error: msg, code }, 409);
    }

    const authUserId = created.user.id;
    const { error: profileErr } = await service.from('profiles').insert({
      id: authUserId,
      display_name: displayName,
      mobile,
      roles: ['SALESMAN'],
      is_active: isActive,
    });

    if (profileErr) {
      // Best-effort rollback so retries are clean.
      await service.auth.admin.deleteUser(authUserId).catch(() => undefined);
      return jsonResponse(
        req,
        {
          error: profileErr.message ?? 'Failed to create salesman profile',
          code: 'PROFILE_CREATE_FAILED',
        },
        500,
      );
    }

    await service.rpc('write_audit_log', {
      p_action: 'salesman.provisioned_admin',
      p_entity_type: 'profile',
      p_entity_id: authUserId,
      p_payload: {
        email,
        mobile,
        createdAuthUser: true,
      },
      p_actor_profile_id: user.id,
      p_actor_role: 'ADMIN',
    });

    await logEvent(service, {
      level: 'info',
      source: 'provision-salesman',
      message: 'Provisioned salesman auth user + profile',
      context: { profileId: authUserId, email },
      durationMs: Date.now() - started,
    });

    return jsonResponse(req, {
      profileId: authUserId,
      authUserId,
      email,
      displayName,
      mobile,
      alreadyProvisioned: false,
      createdAuthUser: true,
      temporaryPasswordSet: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    await logEvent(service, {
      level: 'error',
      source: 'provision-salesman',
      message,
      durationMs: Date.now() - started,
    }).catch(() => undefined);
    return jsonResponse(req, { error: message }, 500);
  }
});
