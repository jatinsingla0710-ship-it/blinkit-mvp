import type { ReactNode } from 'react';
import {
  NavigationGuard,
  SessionProvider,
} from '@groaurum/auth/react';
import { getDeliveryAuthProvider } from '@/auth/createDeliveryAuthProvider';

type Props = {
  children: ReactNode;
};

/**
 * Delivery PWA application foundation providers.
 * Session + navigation audience checks for delivery_pwa.
 */
export function DeliveryAuthProviders({ children }: Props) {
  const provider = getDeliveryAuthProvider();

  return (
    <SessionProvider provider={provider}>
      <NavigationGuard currentAudience="delivery_pwa">
        {children}
      </NavigationGuard>
    </SessionProvider>
  );
}
