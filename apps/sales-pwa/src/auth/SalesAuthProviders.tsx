import type { ReactNode } from 'react';
import {
  NavigationGuard,
  SessionProvider,
} from '@groaurum/auth/react';
import { getSalesAuthProvider } from '@/auth/createSalesAuthProvider';

type Props = {
  children: ReactNode;
};

/**
 * Sales PWA application foundation providers.
 * Session + navigation audience checks for sales_pwa.
 */
export function SalesAuthProviders({ children }: Props) {
  const provider = getSalesAuthProvider();

  return (
    <SessionProvider provider={provider}>
      <NavigationGuard currentAudience="sales_pwa">
        {children}
      </NavigationGuard>
    </SessionProvider>
  );
}
