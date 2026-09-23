/**
 * LEGACY MOCK-ONLY dark-store geo helpers.
 *
 * Used exclusively when EXPO_PUBLIC_CUSTOMER_DATA_ADAPTER=mock.
 * Supabase mode must not call findNearestStore / radius matching —
 * serviceability comes from PIN_CODE / ADMIN_AREA rules on the linked shop.
 */
import type { ServiceabilityResult, Store } from '@/types';
import { stores } from './data';

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Haversine distance in km */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestStore(
  lat: number,
  lng: number
): ServiceabilityResult {
  let best: Store | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const store of stores) {
    const d = distanceKm(lat, lng, store.lat, store.lng);
    if (d < bestDistance) {
      bestDistance = d;
      best = store;
    }
  }

  if (!best || bestDistance > best.serviceRadiusKm) {
    return {
      serviceable: false,
      store: null,
      distanceKm: best ? Number(bestDistance.toFixed(2)) : null,
    };
  }

  return {
    serviceable: true,
    store: best,
    distanceKm: Number(bestDistance.toFixed(2)),
  };
}

export function getStoreById(storeId: string): Store | undefined {
  return stores.find((s) => s.id === storeId);
}
