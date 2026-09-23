import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { GroAurumSupabaseClient } from '@groaurum/api-client';
import { createCustomersRepository } from './ops-repositories';

type Row = Record<string, unknown> & { id: string };
type Filter = { col: string; op: 'eq' | 'is'; value: unknown };

class FakeQuery {
  private filters: Filter[] = [];
  private insertPayload: Record<string, unknown> | null = null;
  private updatePayload: Record<string, unknown> | null = null;
  private wantSingle = false;

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
        is_active: true,
        lifecycle_status: 'LEAD',
        legal_name: null,
        ...this.insertPayload,
      } as Row;
      rows.push(row);
      this.store.set(this.table, rows);
      return {
        data: this.wantSingle ? row : [row],
        error: null,
      };
    }
    if (this.updatePayload) {
      const index = rows.findIndex((row) => this.matches(row));
      if (index < 0) {
        return { data: null, error: { message: 'not found', code: 'PGRST116' } };
      }
      rows[index] = { ...rows[index], ...this.updatePayload };
      return {
        data: this.wantSingle ? rows[index] : [rows[index]],
        error: null,
      };
    }
    const found = rows.filter((row) => this.matches(row));
    return {
      data: this.wantSingle ? found[0] ?? null : found,
      error: null,
    };
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

describe('customers repository create', () => {
  it('creates shop, contact, assignment, and default address', async () => {
    const store = new Map<string, Row[]>();
    const repo = createCustomersRepository(createFakeClient(store));
    const areaId = randomUUID();
    const salesmanId = randomUUID();

    const created = await repo.create({
      tradeName: 'Test Shop',
      ownerName: 'Owner',
      ownerMobile: '+919876543210',
      serviceAreaId: areaId,
      assignedSalesmanProfileId: salesmanId,
      deliveryAddressLine: 'Sector 37',
      deliveryCity: 'New Delhi',
      deliveryState: 'Delhi',
      deliveryPinCode: '110017',
    });

    expect(created.tradeName).toBe('Test Shop');
    expect(created.serviceAreaId).toBe(areaId);
    expect(created.assignedSalesmanProfileId).toBe(salesmanId);
    expect(store.get('shops')).toHaveLength(1);
    expect(store.get('shop_contacts')).toHaveLength(1);
    expect(store.get('shop_salesman_assignments')).toHaveLength(1);
    expect(store.get('customer_addresses')).toHaveLength(1);
    expect(store.get('shop_contacts')?.[0]?.['mobile']).toBe('+919876543210');
    expect(store.get('customer_addresses')?.[0]?.['pin_code']).toBe('110017');
  });
});

describe('customers repository update (Customers H2)', () => {
  it('rejects assignedSalesmanProfileId — must use reassign RPC', async () => {
    const store = new Map<string, Row[]>();
    const repo = createCustomersRepository(createFakeClient(store));
    await expect(
      repo.update(randomUUID(), {
        assignedSalesmanProfileId: randomUUID(),
      }),
    ).rejects.toThrow(/admin_reassign_shop_salesman/i);
  });

  it('allows trade name update without touching assignment', async () => {
    const store = new Map<string, Row[]>();
    const shopId = randomUUID();
    store.set('shops', [
      {
        id: shopId,
        trade_name: 'Old',
        legal_name: null,
        lifecycle_status: 'LEAD',
        service_area_id: randomUUID(),
        assigned_salesman_profile_id: randomUUID(),
        delivery_address_line: 'A',
        delivery_city: 'Delhi',
        delivery_state: 'Delhi',
        delivery_pin_code: '110001',
        delivery_lat: null,
        delivery_lng: null,
        is_active: true,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    const repo = createCustomersRepository(createFakeClient(store));
    const updated = await repo.update(shopId, { tradeName: 'New Name' });
    expect(updated.tradeName).toBe('New Name');
  });
});
