import type { ReactNode } from 'react';
import {
  NavigationGuard,
  SessionProvider,
} from '@groaurum/auth/react';
import { getAdminAuthProvider } from '@/auth/createAdminAuthProvider';

type Props = {
  children: ReactNode;
};

/**
 * Admin ERP application foundation providers.
 * Session + navigation audience checks only — no login UI.
 */
export function AdminAuthProviders({ children }: Props) {
  const provider = getAdminAuthProvider();

  return (
    <SessionProvider provider={provider}>
      <NavigationGuard currentAudience="admin_erp">
        {children}
      </NavigationGuard>
    </SessionProvider>
  );
}
