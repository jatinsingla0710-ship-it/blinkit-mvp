import type { ReactNode } from 'react';
import { resolveAppDestination } from '../helpers';
import type { AppAudience } from '../roles';
import { destinationPathForAudience } from '../navigation';
import { useAuthSession } from './hooks';

type Props = {
  /** Audience of the current running app. */
  currentAudience: AppAudience;
  children: ReactNode;
  /**
   * Called when the signed-in user belongs on another product.
   * Host apps decide how to redirect (URL, deep link, message).
   */
  onWrongAudience?: (target: AppAudience, path: string) => void;
};

/**
 * Navigation guard — ensures Customer / Salesman / Delivery / Admin
 * land on the correct product surface.
 */
export function NavigationGuard({
  currentAudience,
  children,
  onWrongAudience,
}: Props) {
  const { session, isAuthenticated } = useAuthSession();

  if (isAuthenticated && session) {
    const target = resolveAppDestination(session);
    if (target && target !== currentAudience) {
      onWrongAudience?.(target, destinationPathForAudience(target));
    }
  }

  return <>{children}</>;
}
