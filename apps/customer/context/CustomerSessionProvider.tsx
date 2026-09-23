import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  resolveCustomerSession,
  type AuthSession,
} from '@groaurum/api-client';
import type { CustomerSessionSnapshot } from '@groaurum/shared-types';
import { getActiveAdapterMode, getSupabaseCustomerServices } from '@/services/adapters/factory';
import { isMockAdapterMode } from '@/config/env';

type CustomerSessionContextValue = {
  mode: 'mock' | 'supabase';
  snapshot: CustomerSessionSnapshot;
  refresh: () => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  requestPhoneOtp: (mobile: string) => Promise<void>;
  verifyPhoneOtp: (mobile: string, otp: string) => Promise<void>;
  linkVerifiedMobile: (shopId?: string) => Promise<{
    linked: boolean;
    shopId?: string;
    alreadyLinked?: boolean;
    reason?: string;
    choices?: { shopId: string; shopName: string }[];
  }>;
  acceptShopInvitation: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const initialSnapshot: CustomerSessionSnapshot = {
  phase: 'AUTH_LOADING',
  authUserId: null,
  mobile: null,
  profile: null,
  shopContext: null,
  serviceability: null,
};

const CustomerSessionContext = createContext<CustomerSessionContextValue | null>(null);

function clearCustomerQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.removeQueries({ queryKey: ['customer'] });
  queryClient.removeQueries({ queryKey: ['categories'] });
  queryClient.removeQueries({ queryKey: ['products'] });
  queryClient.removeQueries({ queryKey: ['bestsellers'] });
  queryClient.removeQueries({ queryKey: ['orders'] });
  queryClient.removeQueries({ queryKey: ['order'] });
  queryClient.removeQueries({ queryKey: ['search'] });
  queryClient.removeQueries({ queryKey: ['product'] });
  queryClient.removeQueries({ queryKey: ['category'] });
}

export function CustomerSessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const mode = getActiveAdapterMode();
  const [snapshot, setSnapshot] = useState<CustomerSessionSnapshot>(
    mode === 'mock'
      ? {
          phase: 'LINKED_SHOP_READY',
          authUserId: 'mock-guest',
          mobile: null,
          profile: null,
          shopContext: null,
          serviceability: {
            status: 'SERVICEABLE',
            serviceable: true,
            serviceArea: null,
            matchedRuleId: null,
          },
        }
      : initialSnapshot,
  );

  const refresh = useCallback(async () => {
    if (isMockAdapterMode()) {
      return;
    }
    const services = getSupabaseCustomerServices();
    if (!services?.client) {
      setSnapshot({
        phase: 'ERROR',
        authUserId: null,
        mobile: null,
        profile: null,
        shopContext: null,
        serviceability: null,
        errorMessage: 'Supabase configuration is missing or invalid.',
      });
      return;
    }

    setSnapshot((prev) => ({
      ...prev,
      phase: prev.authUserId ? 'LINKED_SHOP_LOADING' : 'AUTH_LOADING',
    }));

    const next = await resolveCustomerSession(services.client);
    setSnapshot(next);
  }, []);

  useEffect(() => {
    if (isMockAdapterMode()) {
      if (typeof console !== 'undefined') {
        console.info('[groaurum] customer data adapter mode: mock');
      }
      return;
    }

    void refresh();

    const services = getSupabaseCustomerServices();
    if (!services) return;

    const { unsubscribe } = services.auth.onAuthStateChange((_session: AuthSession | null) => {
      void refresh();
    });

    return () => unsubscribe();
  }, [refresh]);

  const signInWithEmailPassword = useCallback(
    async (email: string, password: string) => {
      const services = getSupabaseCustomerServices();
      if (!services) {
        throw new Error('Supabase adapter is not active.');
      }
      await services.auth.signInWithEmailPassword(email, password);
      await refresh();
    },
    [refresh],
  );

  const requestPhoneOtp = useCallback(async (mobile: string) => {
    const services = getSupabaseCustomerServices();
    if (!services) {
      throw new Error('Supabase adapter is not active.');
    }
    await services.auth.requestPhoneOtp(mobile);
  }, []);

  const verifyPhoneOtp = useCallback(
    async (mobile: string, otp: string) => {
      const services = getSupabaseCustomerServices();
      if (!services) {
        throw new Error('Supabase adapter is not active.');
      }
      await services.auth.verifyPhoneOtp(mobile, otp);
      const auth = services.auth as {
        linkVerifiedMobile?: (shopId?: string) => Promise<unknown>;
      };
      if (auth.linkVerifiedMobile) {
        try {
          await auth.linkVerifiedMobile();
        } catch {
          // No matching shop yet — CustomerFlowGate handles selection / token fallback.
        }
      }
      await refresh();
    },
    [refresh],
  );

  const linkVerifiedMobile = useCallback(async (shopId?: string) => {
    const services = getSupabaseCustomerServices();
    if (!services) {
      throw new Error('Supabase adapter is not active.');
    }
    const auth = services.auth as {
      linkVerifiedMobile?: (shopId?: string) => Promise<{
        linked: boolean;
        shopId?: string;
        alreadyLinked?: boolean;
        reason?: string;
        choices?: { shopId: string; shopName: string }[];
      }>;
    };
    if (!auth.linkVerifiedMobile) {
      throw new Error('Mobile linking is not available.');
    }
    const result = await auth.linkVerifiedMobile(shopId);
    await refresh();
    return result;
  }, [refresh]);

  const acceptShopInvitation = useCallback(
    async (token: string) => {
      const services = getSupabaseCustomerServices();
      if (!services) {
        throw new Error('Supabase adapter is not active.');
      }
      await services.auth.acceptShopInvitation(token);
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    const services = getSupabaseCustomerServices();
    if (services) {
      await services.auth.signOut();
    }
    clearCustomerQueries(queryClient);
    setSnapshot({
      phase: 'UNAUTHENTICATED',
      authUserId: null,
      mobile: null,
      profile: null,
      shopContext: null,
      serviceability: null,
    });
  }, [queryClient]);

  const value = useMemo(
    () => ({
      mode,
      snapshot,
      refresh,
      signInWithEmailPassword,
      requestPhoneOtp,
      verifyPhoneOtp,
      linkVerifiedMobile,
      acceptShopInvitation,
      signOut,
    }),
    [
      mode,
      snapshot,
      refresh,
      signInWithEmailPassword,
      requestPhoneOtp,
      verifyPhoneOtp,
      linkVerifiedMobile,
      acceptShopInvitation,
      signOut,
    ],
  );

  return (
    <CustomerSessionContext.Provider value={value}>
      {children}
    </CustomerSessionContext.Provider>
  );
}

export function useCustomerSession() {
  const ctx = useContext(CustomerSessionContext);
  if (!ctx) {
    throw new Error('useCustomerSession must be used within CustomerSessionProvider');
  }
  return ctx;
}
