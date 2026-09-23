import type {
  ServiceArea,
  ServiceabilityEvaluationInput,
  ServiceabilityEvaluationResult,
  ServiceabilityRule,
} from '@groaurum/shared-types';

export interface ServiceAreaService {
  listServiceAreas(activeOnly?: boolean): Promise<ServiceArea[]>;
  getServiceAreaById(serviceAreaId: string): Promise<ServiceArea | null>;
  listServiceabilityRules(serviceAreaId: string): Promise<ServiceabilityRule[]>;
  evaluateServiceability(
    input: ServiceabilityEvaluationInput
  ): Promise<ServiceabilityEvaluationResult>;
}
