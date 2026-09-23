import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { GroAurumSupabaseClient } from '@groaurum/api-client';
import {
  createServiceAreasRepository,
  createServiceabilityRulesRepository,
  createOperationalLocationsRepository,
  mapServiceAreaRow,
  mapServiceabilityRuleRow,
  mapOperationalLocationRow,
  pinCodesFromConfig,
} from './territory-repositories';

type Row = Record<string, unknown> & { id: string };

type Filter = { col: string; op: 'eq' | 'is'; value: unknown };

class FakeQuery {
  private filters: Filter[] = [];
  private insertPayload: Record<string, unknown> | null = null;
  private updatePayload: Record<string, unknown> | null = null;
  private wantSingle = false;
  private wantMaybe = false;

  constructor(
    private readonly store: Map<string, Row[]>,
    private readonly table: string,
  ) {}

  select() {
    return this;
  }

  order() {
    return this;
  }

  is(col: string, value: unknown) {
    this.filters.push({ col, op: 'is', value });
    return this;
  }

  eq(col: string, value: unknown) {
    this.filters.push({ col, op: 'eq', value });
    return this;
  }

  insert(payload: Record<string, unknown>) {
    this.insertPayload = payload;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.updatePayload = payload;
    return this;
  }

  single() {
    this.wantSingle = true;
    return this;
  }

  maybeSingle() {
    this.wantMaybe = true;
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((filter) => {
      if (filter.op === 'eq') return row[filter.col] === filter.value;
      if (filter.value === null) return row[filter.col] == null;
      return row[filter.col] === filter.value;
    });
  }

  private execute() {
    const rows = this.store.get(this.table) ?? [];
    if (this.insertPayload) {
      const now = new Date().toISOString();
      const row = {
        id: String(this.insertPayload.id ?? randomUUID()),
        deleted_at: null,
        created_at: now,
        updated_at: now,
        display_order: 0,
        is_active: true,
        description: null,
        ...this.insertPayload,
      } as Row;
      rows.push(row);
      this.store.set(this.table, rows);
      return {
        data: this.wantSingle || this.wantMaybe ? row : [row],
        error: null,
      };
    }
    if (this.updatePayload) {
      const index = rows.findIndex((row) => this.matches(row));
      if (index < 0) {
        return {
          data: null,
          error: { message: 'not found', code: 'PGRST116' },
        };
      }
      rows[index] = { ...rows[index], ...this.updatePayload };
      const row = rows[index];
      return {
        data: this.wantSingle || this.wantMaybe ? row : [row],
        error: null,
      };
    }
    const found = rows.filter((row) => this.matches(row));
    if (this.wantSingle) {
      return found[0]
        ? { data: found[0], error: null }
        : { data: null, error: { message: 'not found', code: 'PGRST116' } };
    }
    if (this.wantMaybe) {
      return { data: found[0] ?? null, error: null };
    }
    return { data: found, error: null };
  }

  then<TResult1, TResult2>(
    resolve?: (value: { data: unknown; error: unknown }) => TResult1,
    reject?: (reason: unknown) => TResult2,
  ) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }
}

function createFakeClient(store: Map<string, Row[]>) {
  return {
    from(table: string) {
      return new FakeQuery(store, table);
    },
  } as unknown as GroAurumSupabaseClient;
}

describe('territory mappers', () => {
  it('maps service area rows', () => {
    const mapped = mapServiceAreaRow({
      id: 'area-1',
      name: 'South Delhi',
      description: 'Launch',
      display_order: 1,
      is_active: true,
      deleted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    expect(mapped.name).toBe('South Delhi');
    expect(mapped.isActive).toBe(true);
  });

  it('extracts PIN codes from rule config', () => {
    expect(pinCodesFromConfig({ pinCodes: ['110017', '110074'] })).toEqual([
      '110017',
      '110074',
    ]);
    expect(pinCodesFromConfig(null)).toEqual([]);
  });

  it('maps PIN_CODE serviceability rules', () => {
    const mapped = mapServiceabilityRuleRow({
      id: 'rule-1',
      service_area_id: 'area-1',
      rule_type: 'PIN_CODE',
      is_active: true,
      config: { pinCodes: ['110017'] },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    expect(mapped.ruleType).toBe('PIN_CODE');
    expect(mapped.config).toEqual({
      ruleType: 'PIN_CODE',
      pinCodes: ['110017'],
    });
  });

  it('maps operational location rows', () => {
    const mapped = mapOperationalLocationRow({
      id: 'loc-1',
      name: 'GroAurum Warehouse 1',
      kind: 'OPS_BASE',
      address_line: 'Warehouse Complex, Sector 37',
      city: 'New Delhi',
      state: 'Delhi',
      pin_code: '110074',
      lat: null,
      lng: null,
      is_active: true,
      deleted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    expect(mapped.addressLine).toBe('Warehouse Complex, Sector 37');
    expect(mapped.pinCode).toBe('110074');
    expect(mapped.isActive).toBe(true);
  });
});

describe('service area repository', () => {
  it('creates, lists, and deactivates a service area', async () => {
    const store = new Map<string, Row[]>();
    const repo = createServiceAreasRepository(createFakeClient(store));

    const created = await repo.create({
      name: 'Test Territory',
      description: 'Isolated test',
      isActive: true,
    });
    expect(created.name).toBe('Test Territory');
    expect(created.isActive).toBe(true);

    const listed = await repo.list();
    expect(listed).toHaveLength(1);

    const updated = await repo.update(created.id, { isActive: false });
    expect(updated.isActive).toBe(false);
  });
});

describe('serviceability rule repository', () => {
  it('creates and updates a PIN_CODE rule', async () => {
    const store = new Map<string, Row[]>();
    const areaId = randomUUID();
    const repo = createServiceabilityRulesRepository(createFakeClient(store));

    const created = await repo.create({
      serviceAreaId: areaId,
      ruleType: 'PIN_CODE',
      pinCodes: ['110017', '110074'],
    });
    expect(created.serviceAreaId).toBe(areaId);
    expect(created.config).toEqual({
      ruleType: 'PIN_CODE',
      pinCodes: ['110017', '110074'],
    });

    const updated = await repo.update(created.id, {
      pinCodes: ['110017', '110019', '110074'],
    });
    expect(updated.config).toEqual({
      ruleType: 'PIN_CODE',
      pinCodes: ['110017', '110019', '110074'],
    });

    const listed = await repo.list();
    expect(listed).toHaveLength(1);
  });
});

describe('operational location repository', () => {
  it('creates, lists, and deactivates a warehouse', async () => {
    const store = new Map<string, Row[]>();
    const repo = createOperationalLocationsRepository(createFakeClient(store));

    const created = await repo.create({
      name: 'Test Warehouse',
      addressLine: 'Sector 37',
      city: 'New Delhi',
      state: 'Delhi',
      pinCode: '110074',
      isActive: true,
    });
    expect(created.name).toBe('Test Warehouse');
    expect(created.pinCode).toBe('110074');
    expect(created.isActive).toBe(true);

    const listed = await repo.list();
    expect(listed).toHaveLength(1);

    const updated = await repo.update(created.id, { isActive: false });
    expect(updated.isActive).toBe(false);
  });
});
