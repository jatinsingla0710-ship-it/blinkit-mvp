import type { ServiceabilityRuleType } from './enums';

/**
 * Primary business entity for operational delivery territory.
 * Identity is stable; membership rules may evolve (PIN, admin area, polygon).
 */
export interface ServiceArea {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Extensible serviceability rule bound to a ServiceArea. */
export type ServiceabilityRuleConfig =
  | {
      ruleType: 'PIN_CODE';
      pinCodes: string[];
    }
  | {
      ruleType: 'ADMIN_AREA';
      areaCodes: string[];
    }
  | {
      /** Polygon/geofence reference — not implemented in Phase 1. */
      ruleType: 'POLYGON';
      polygonRef: string;
    };

export interface ServiceabilityRule {
  id: string;
  serviceAreaId: string;
  ruleType: ServiceabilityRuleType;
  isActive: boolean;
  config: ServiceabilityRuleConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceabilityEvaluationInput {
  pinCode?: string;
  adminAreaCode?: string;
  lat?: number;
  lng?: number;
}

/**
 * Outcome of shop/address serviceability evaluation.
 * Multiple matching areas resolve by lowest displayOrder, then name.
 */
export type ServiceabilityStatus =
  | 'SERVICEABLE'
  | 'NOT_SERVICEABLE'
  | 'INSUFFICIENT_ADDRESS_DATA'
  | 'UNSUPPORTED_RULE_TYPE'
  | 'ERROR';

export interface ServiceabilityEvaluationResult {
  status: ServiceabilityStatus;
  serviceable: boolean;
  serviceArea: ServiceArea | null;
  matchedRuleId: string | null;
  message?: string;
}
