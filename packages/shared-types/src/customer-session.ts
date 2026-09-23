import type { Shop, ShopContact } from './shop';
import type { StaffProfile } from './staff';
import type { ServiceabilityEvaluationResult } from './service-area';

/** Explicit customer app session / shop-link phases (Phase 3). */
export type CustomerAppPhase =
  | 'AUTH_LOADING'
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATED_NO_SHOP_LINK'
  | 'LINKED_SHOP_LOADING'
  | 'LINKED_SHOP_READY'
  | 'LINKED_SHOP_INACTIVE_OR_BLOCKED'
  | 'ERROR';

export interface CustomerShopContext {
  authUserId: string;
  mobile: string | null;
  profile: StaffProfile | null;
  shop: Shop;
  contacts: ShopContact[];
}

export interface CustomerSessionSnapshot {
  phase: CustomerAppPhase;
  authUserId: string | null;
  mobile: string | null;
  profile: StaffProfile | null;
  shopContext: CustomerShopContext | null;
  serviceability: ServiceabilityEvaluationResult | null;
  errorMessage?: string;
}
