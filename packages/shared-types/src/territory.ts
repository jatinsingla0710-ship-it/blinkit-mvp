/**
 * Development / launch territory defaults for GroAurum B2B wholesale.
 * Serviceability itself is data-driven (service_areas + serviceability_rules).
 * This constant is only a central fallback for maps, admin quick-create, and tests.
 */
export const DEFAULT_SERVICE_TERRITORY = {
  displayName: 'South Delhi',
  city: 'New Delhi',
  state: 'Delhi',
  pinCode: '110017',
  mapsQuery: 'South Delhi',
  adminAreaCode: 'DL-SOUTH',
  pinCodes: ['110017', '110019', '110020', '110024', '110048', '110062'] as const,
  /** Stable sprint-4 seed service area id — used only when live rows are unavailable. */
  seedServiceAreaId: 'a2000000-0000-4000-8000-000000000001',
} as const;

export type DefaultServiceTerritory = typeof DEFAULT_SERVICE_TERRITORY;
