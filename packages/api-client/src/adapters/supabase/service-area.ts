import type { ServiceAreaService } from '../../contracts/service-area';
import type {
  ServiceArea,
  ServiceabilityEvaluationInput,
  ServiceabilityEvaluationResult,
  ServiceabilityRule,
} from '@groaurum/shared-types';
import { evaluateServiceabilityRules } from '../../serviceability/evaluate';
import type { GroAurumSupabaseClient } from '../../supabase/client';
import { mapServiceArea, mapServiceabilityRule } from './mappers';

export function createSupabaseServiceAreaService(
  client: GroAurumSupabaseClient,
): ServiceAreaService {
  return {
    async listServiceAreas(activeOnly = true): Promise<ServiceArea[]> {
      let q = client
        .from('service_areas')
        .select('*')
        .order('display_order', { ascending: true });
      if (activeOnly) {
        q = q.eq('is_active', true);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(mapServiceArea);
    },

    async getServiceAreaById(serviceAreaId: string): Promise<ServiceArea | null> {
      const { data, error } = await client
        .from('service_areas')
        .select('*')
        .eq('id', serviceAreaId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapServiceArea(data) : null;
    },

    async listServiceabilityRules(serviceAreaId: string): Promise<ServiceabilityRule[]> {
      const { data, error } = await client
        .from('serviceability_rules')
        .select('*')
        .eq('service_area_id', serviceAreaId);
      if (error) throw error;
      return (data ?? [])
        .map(mapServiceabilityRule)
        .filter((rule): rule is ServiceabilityRule => rule != null);
    },

    async evaluateServiceability(
      input: ServiceabilityEvaluationInput,
    ): Promise<ServiceabilityEvaluationResult> {
      const { data: areaRows, error: areaError } = await client
        .from('service_areas')
        .select('*');
      if (areaError) throw areaError;

      const { data: ruleRows, error: ruleError } = await client
        .from('serviceability_rules')
        .select('*');
      if (ruleError) throw ruleError;

      const areas = (areaRows ?? []).map(mapServiceArea);
      const rules = (ruleRows ?? [])
        .map(mapServiceabilityRule)
        .filter((rule): rule is ServiceabilityRule => rule != null);

      return evaluateServiceabilityRules(areas, rules, input);
    },
  };
}
