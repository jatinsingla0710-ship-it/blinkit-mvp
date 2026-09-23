import type {
  AuthSession,
  AuthenticationShopLinkingService,
} from '../../contracts/auth';
import type { ShopAuthLink } from '@groaurum/shared-types';
import type { GroAurumSupabaseClient } from '../../supabase/client';
import { mapProfile, mapShopAuthLink } from './mappers';

function normalizeMobileHint(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (mobile.trim().startsWith('+')) return mobile.trim();
  return mobile.trim();
}

async function ensureCustomerProfile(client: GroAurumSupabaseClient): Promise<void> {
  const { error } = await (client as unknown as {
    rpc: (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc('ensure_customer_profile_from_auth');
  if (error) throw new Error(error.message);
}

async function buildSession(
  client: GroAurumSupabaseClient,
  authUserId: string,
  mobileHint?: string | null,
): Promise<AuthSession> {
  const { data: profileRow } = await client
    .from('profiles')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle();

  const profile = profileRow ? mapProfile(profileRow) : null;

  const { data: linkRow } = await client
    .from('shop_auth_links')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  return {
    authUserId,
    mobile: profile?.mobile ?? mobileHint ?? '',
    profile,
    linkedShopId: linkRow?.shop_id ?? null,
  };
}

/**
 * Customer auth session adapter (Sprint 6).
 *
 * - Persists / restores via Supabase Auth session (persistSession on client)
 * - Phone OTP via signInWithOtp / verifyOtp (requires SMS provider in production)
 * - Email/password ready for local/dev and future email OTP
 * - Invitation accept via accept_shop_invitation RPC
 */
export function createSupabaseAuthService(
  client: GroAurumSupabaseClient,
): AuthenticationShopLinkingService & {
  signOut(): Promise<void>;
  signInWithEmailPassword(email: string, password: string): Promise<AuthSession>;
  requestEmailOtp(email: string): Promise<void>;
  verifyEmailOtp(email: string, otp: string): Promise<AuthSession>;
  acceptShopInvitation(token: string): Promise<string>;
  onAuthStateChange(
    callback: (session: AuthSession | null) => void,
  ): { unsubscribe: () => void };
} {
  return {
    async getCurrentSession(): Promise<AuthSession | null> {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      const user = data.session?.user;
      if (!user) return null;
      return buildSession(client, user.id, user.phone ?? user.email ?? null);
    },

    async requestPhoneOtp(mobile: string): Promise<void> {
      const phone = normalizeMobileHint(mobile);
      const { error } = await client.auth.signInWithOtp({ phone });
      if (error) {
        throw new Error(
          `${error.message}. Phone OTP requires Supabase SMS configuration. ` +
            'For local development use email/password (customer@groaurum.local).',
        );
      }
    },

    async verifyPhoneOtp(mobile: string, otp: string): Promise<AuthSession> {
      const phone = normalizeMobileHint(mobile);
      const { data, error } = await client.auth.verifyOtp({
        phone,
        token: otp.trim(),
        type: 'sms',
      });
      if (error) throw error;
      if (!data.user) {
        throw new Error('OTP verification succeeded without a user session.');
      }
      await ensureCustomerProfile(client);
      return buildSession(client, data.user.id, data.user.phone ?? phone);
    },

    async ensureCustomerProfile(): Promise<void> {
      await ensureCustomerProfile(client);
    },

    async linkVerifiedMobile(shopId?: string): Promise<{
      linked: boolean;
      shopId?: string;
      alreadyLinked?: boolean;
      reason?: string;
      choices?: { shopId: string; shopName: string }[];
    }> {
      const { data, error } = await (client as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }).rpc('customer_link_verified_mobile', {
        p_shop_id: shopId ?? null,
      });
      if (error) throw new Error(error.message);
      const payload = (data ?? {}) as Record<string, unknown>;
      const rawChoices = Array.isArray(payload['choices'])
        ? (payload['choices'] as Record<string, unknown>[])
        : [];
      return {
        linked: Boolean(payload['linked']),
        shopId: payload['shopId'] ? String(payload['shopId']) : undefined,
        alreadyLinked: payload['alreadyLinked']
          ? Boolean(payload['alreadyLinked'])
          : undefined,
        reason: payload['reason'] ? String(payload['reason']) : undefined,
        choices: rawChoices.map((row) => ({
          shopId: String(row['shopId'] ?? row['shop_id']),
          shopName: String(row['shopName'] ?? row['shop_name'] ?? 'Shop'),
        })),
      };
    },

    async requestEmailOtp(email: string): Promise<void> {
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
    },

    async verifyEmailOtp(email: string, otp: string): Promise<AuthSession> {
      const { data, error } = await client.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'email',
      });
      if (error) throw error;
      if (!data.user) {
        throw new Error('Email OTP verification succeeded without a user session.');
      }
      return buildSession(client, data.user.id, data.user.email);
    },

    async linkAuthToShopOnLogin(
      _mobile: string,
      _authUserId: string,
    ): Promise<ShopAuthLink> {
      throw new Error(
        'Use acceptShopInvitation(token) after sign-in. Direct shop link creation is not available on the customer client.',
      );
    },

    async acceptShopInvitation(token: string): Promise<string> {
      const { data, error } = await (client as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }).rpc('accept_shop_invitation', { p_token: token.trim() });
      if (error) throw new Error(error.message);
      return String(data);
    },

    async signOut(): Promise<void> {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },

    async signInWithEmailPassword(email: string, password: string): Promise<AuthSession> {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) {
        throw new Error('Sign-in succeeded without a user session.');
      }
      return buildSession(client, data.user.id, data.user.email);
    },

    onAuthStateChange(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        void (async () => {
          if (!session?.user) {
            callback(null);
            return;
          }
          try {
            callback(
              await buildSession(
                client,
                session.user.id,
                session.user.phone ?? session.user.email ?? null,
              ),
            );
          } catch {
            callback(null);
          }
        })();
      });
      return { unsubscribe: () => data.subscription.unsubscribe() };
    },
  };
}

export async function resolveLinkedShopAuthLink(
  client: GroAurumSupabaseClient,
  authUserId: string,
): Promise<ShopAuthLink | null> {
  const { data, error } = await client
    .from('shop_auth_links')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapShopAuthLink(data) : null;
}
