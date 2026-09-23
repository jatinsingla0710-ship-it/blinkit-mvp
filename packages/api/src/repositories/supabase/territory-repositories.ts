import type {
  OperationalLocation,
  ServiceArea,
  ServiceabilityRule,
} from '@groaurum/shared-types';
import type { GroAurumSupabaseClient } from '@groaurum/api-client';
import type { CrudRepository } from '@groaurum/data';
import type {
  ServiceAreaCreateInput,
  ServiceAreaUpdateInput,
  ServiceabilityRuleCreateInput,
  ServiceabilityRuleUpdateInput,
  WarehouseCreateInput,
  WarehouseUpdateInput,
} from '@groaurum/validation';
import type { MemoryCache } from '../../cache/memory-cache';
import { createSupabaseCrudRepository } from './create-supabase-crud-repository';

type ServiceAreaRow = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type ServiceabilityRuleRow = {
  id: string;
  service_area_id: string;
  rule_type: ServiceabilityRule['ruleType'];
  is_active: boolean;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type OperationalLocationRow = {
  id: string;
  name: string;
  kind: OperationalLocation['kind'];
  address_line: string;
  city: string;
  state: string;
  pin_code: string;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapOperationalLocationRow(
  row: OperationalLocationRow,
): OperationalLocation {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    pinCode: row.pin_code,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapServiceAreaRow(row: ServiceAreaRow): ServiceArea {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    isActive: row.is_active,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function pinCodesFromConfig(config: unknown): string[] {
  if (!config || typeof config !== 'object') return [];
  const pins = (config as Record<string, unknown>)['pinCodes'];
  if (!Array.isArray(pins)) return [];
  return pins.map((pin) => String(pin));
}

export function mapServiceabilityRuleRow(
  row: ServiceabilityRuleRow,
): ServiceabilityRule {
  const pinCodes = pinCodesFromConfig(row.config);
  if (row.rule_type === 'ADMIN_AREA') {
    const areaCodesRaw =
      row.config && typeof row.config === 'object'
        ? (row.config as Record<string, unknown>)['areaCodes']
        : undefined;
    const areaCodes = Array.isArray(areaCodesRaw)
      ? areaCodesRaw.map((code) => String(code))
      : [];
    return {
      id: row.id,
      serviceAreaId: row.service_area_id,
      ruleType: 'ADMIN_AREA',
      isActive: row.is_active,
      config: { ruleType: 'ADMIN_AREA', areaCodes },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  if (row.rule_type === 'POLYGON') {
    const polygonRef =
      row.config && typeof row.config === 'object'
        ? String((row.config as Record<string, unknown>)['polygonRef'] ?? '')
        : '';
    return {
      id: row.id,
      serviceAreaId: row.service_area_id,
      ruleType: 'POLYGON',
      isActive: row.is_active,
      config: { ruleType: 'POLYGON', polygonRef },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  return {
    id: row.id,
    serviceAreaId: row.service_area_id,
    ruleType: 'PIN_CODE',
    isActive: row.is_active,
    config: { ruleType: 'PIN_CODE', pinCodes },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createServiceAreasRepository(
  client: GroAurumSupabaseClient,
  cache?: MemoryCache,
): CrudRepository<
  ServiceArea,
  ServiceArea,
  ServiceAreaCreateInput,
  ServiceAreaUpdateInput
> {
  return createSupabaseCrudRepository({
    client,
    entity: 'service_areas',
    table: 'service_areas',
    cache,
    mapList: mapServiceAreaRow,
    mapDetail: mapServiceAreaRow,
    searchColumns: ['name', 'description'],
    toInsert: (input) => ({
      name: input.name,
      description: input.description ?? null,
      display_order: input.displayOrder ?? 0,
      is_active: input.isActive ?? true,
    }),
    toUpdate: (input) => ({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.displayOrder !== undefined
        ? { display_order: input.displayOrder }
        : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    }),
  });
}

export function createServiceabilityRulesRepository(
  client: GroAurumSupabaseClient,
  cache?: MemoryCache,
): CrudRepository<
  ServiceabilityRule,
  ServiceabilityRule,
  ServiceabilityRuleCreateInput,
  ServiceabilityRuleUpdateInput
> {
  return createSupabaseCrudRepository({
    client,
    entity: 'serviceability_rules',
    table: 'serviceability_rules',
    cache,
    softDelete: false,
    mapList: mapServiceabilityRuleRow,
    mapDetail: mapServiceabilityRuleRow,
    searchColumns: ['rule_type'],
    toInsert: (input) => ({
      service_area_id: input.serviceAreaId,
      rule_type: input.ruleType,
      is_active: input.isActive ?? true,
      config: { pinCodes: input.pinCodes },
    }),
    toUpdate: (input) => ({
      ...(input.pinCodes !== undefined
        ? { config: { pinCodes: input.pinCodes } }
        : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    }),
  });
}

export function createOperationalLocationsRepository(
  client: GroAurumSupabaseClient,
  cache?: MemoryCache,
): CrudRepository<
  OperationalLocation,
  OperationalLocation,
  WarehouseCreateInput,
  WarehouseUpdateInput
> {
  return createSupabaseCrudRepository({
    client,
    entity: 'operational_locations',
    table: 'operational_locations',
    cache,
    mapList: mapOperationalLocationRow,
    mapDetail: mapOperationalLocationRow,
    searchColumns: ['name', 'city', 'state', 'pin_code', 'address_line'],
    toInsert: (input) => ({
      name: input.name,
      kind: input.kind ?? 'OPS_BASE',
      address_line: input.addressLine,
      city: input.city,
      state: input.state,
      pin_code: input.pinCode,
      ...(input.lat !== undefined ? { lat: input.lat } : {}),
      ...(input.lng !== undefined ? { lng: input.lng } : {}),
      is_active: input.isActive ?? true,
    }),
    toUpdate: (input) => ({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.addressLine !== undefined
        ? { address_line: input.addressLine }
        : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.pinCode !== undefined ? { pin_code: input.pinCode } : {}),
      ...(input.lat !== undefined ? { lat: input.lat } : {}),
      ...(input.lng !== undefined ? { lng: input.lng } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    }),
  });
}
