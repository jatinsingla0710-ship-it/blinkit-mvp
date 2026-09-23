/**
 * Legacy mock-only location store.
 *
 * Dark-store / nearest-hub matching runs ONLY when the customer data adapter
 * is `mock`. In Supabase mode this store is unused for catalogue access —
 * serviceability comes from PIN/service-area rules on the linked shop.
 */
import { create } from 'zustand';
import type { Address, Store } from '@/types';
import { isMockAdapterMode } from '@/config/env';
import { findNearestStore } from '@/services/mock/geo';

interface LocationState {
  address: Address | null;
  store: Store | null;
  distanceKm: number | null;
  serviceable: boolean;
  setAddress: (address: Address) => void;
  clearLocation: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  address: null,
  store: null,
  distanceKm: null,
  serviceable: false,
  setAddress: (address) => {
    if (!isMockAdapterMode()) {
      set({
        address,
        store: null,
        distanceKm: null,
        serviceable: false,
      });
      return;
    }

    const result = findNearestStore(address.lat, address.lng);
    set({
      address,
      store: result.store,
      distanceKm: result.distanceKm,
      serviceable: result.serviceable,
    });
  },
  clearLocation: () =>
    set({
      address: null,
      store: null,
      distanceKm: null,
      serviceable: false,
    }),
}));
