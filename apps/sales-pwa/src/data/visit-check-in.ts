import type { SalesmanVisit } from '@groaurum/api-client';
import { GeoReadError } from '@/data/geolocation';

export function sortVisitsByPlannedTime<T extends { id: string; plannedAt: string }>(
  visits: readonly T[],
): T[] {
  return [...visits].sort(
    (a, b) => a.plannedAt.localeCompare(b.plannedAt) || a.id.localeCompare(b.id),
  );
}

export function formatDistanceMetres(metres: number | null | undefined): string | null {
  if (metres == null || !Number.isFinite(metres) || metres < 0) return null;
  return `You are approximately ${Math.round(metres)} m from this shop`;
}

/** Permission failure is never a successful check-in. */
export function visitCheckInFailureMessage(error: unknown): string {
  if (error instanceof GeoReadError) {
    if (error.reason === 'denied') {
      return 'Location permission is required to verify this visit.';
    }
    if (error.reason === 'timeout') return 'Location request timed out. Try again.';
    if (error.reason === 'unsupported') return 'This device cannot share its location.';
    if (error.reason === 'invalid') return 'The device returned an invalid location. Try again.';
    return 'Current location is unavailable. Try again.';
  }
  return error instanceof Error ? error.message : 'Could not verify this visit.';
}

export function visitIsComplete(status: SalesmanVisit['status']): boolean {
  return status === 'VISITED' || status === 'SHOP_CLOSED';
}

/** Ignores a second tap while the first action is still running. */
export function createActionLock() {
  let held = false;
  return {
    tryAcquire(): boolean {
      if (held) return false;
      held = true;
      return true;
    },
    release(): void {
      held = false;
    },
  };
}
