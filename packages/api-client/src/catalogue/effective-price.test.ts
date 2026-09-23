import { describe, expect, it } from 'vitest';
import { selectEffectiveSkuPrice } from './effective-price';
import {
  parseCustomerDataAdapterMode,
  parsePublicSupabaseConfig,
} from '../config';

describe('selectEffectiveSkuPrice', () => {
  const base = {
    sku_id: 'sku-1',
    currency: 'INR',
  };

  it('selects open current price', () => {
    const price = selectEffectiveSkuPrice(
      [
        {
          ...base,
          id: 'p1',
          trade_price: 100,
          effective_from: '2026-01-01T00:00:00Z',
          effective_to: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(price?.id).toBe('p1');
    expect(price?.tradePrice).toBe(100);
  });

  it('ignores future prices', () => {
    const price = selectEffectiveSkuPrice(
      [
        {
          ...base,
          id: 'future',
          trade_price: 200,
          effective_from: '2026-12-01T00:00:00Z',
          effective_to: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(price).toBeNull();
  });

  it('ignores expired prices', () => {
    const price = selectEffectiveSkuPrice(
      [
        {
          ...base,
          id: 'old',
          trade_price: 80,
          effective_from: '2025-01-01T00:00:00Z',
          effective_to: '2026-01-01T00:00:00Z',
          created_at: '2025-01-01T00:00:00Z',
        },
      ],
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(price).toBeNull();
  });

  it('prefers newest effective_from among overlapping rows', () => {
    const price = selectEffectiveSkuPrice(
      [
        {
          ...base,
          id: 'older',
          trade_price: 90,
          effective_from: '2026-01-01T00:00:00Z',
          effective_to: '2026-12-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          ...base,
          id: 'newer',
          trade_price: 110,
          effective_from: '2026-03-01T00:00:00Z',
          effective_to: null,
          created_at: '2026-03-01T00:00:00Z',
        },
      ],
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(price?.id).toBe('newer');
    expect(price?.tradePrice).toBe(110);
  });

  it('keeps the current price live until effective_to and switches to the scheduled price after that', () => {
    const rows = [
      {
        ...base,
        id: 'current',
        trade_price: 100,
        effective_from: '2026-08-20T00:00:00Z',
        effective_to: '2026-08-21T00:00:00Z',
        created_at: '2026-08-20T00:00:00Z',
      },
      {
        ...base,
        id: 'scheduled',
        trade_price: 120,
        effective_from: '2026-08-21T00:00:00Z',
        effective_to: null,
        created_at: '2026-08-20T06:00:00Z',
      },
    ];

    expect(
      selectEffectiveSkuPrice(rows, new Date('2026-08-20T12:00:00Z'))?.id,
    ).toBe('current');
    expect(
      selectEffectiveSkuPrice(rows, new Date('2026-08-21T00:00:00Z'))?.id,
    ).toBe('scheduled');
  });

  it('treats effective_to as an exclusive upper bound', () => {
    const price = selectEffectiveSkuPrice(
      [
        {
          ...base,
          id: 'expires-now',
          trade_price: 100,
          effective_from: '2026-08-20T00:00:00Z',
          effective_to: '2026-08-21T00:00:00Z',
          created_at: '2026-08-20T00:00:00Z',
        },
      ],
      new Date('2026-08-21T00:00:00Z'),
    );

    expect(price).toBeNull();
  });
});

describe('adapter config validation', () => {
  it('accepts mock and supabase modes', () => {
    expect(parseCustomerDataAdapterMode('mock')).toBe('mock');
    expect(parseCustomerDataAdapterMode('supabase')).toBe('supabase');
  });

  it('rejects invalid adapter mode', () => {
    expect(() => parseCustomerDataAdapterMode('prod')).toThrow(/Invalid customer data adapter mode/);
  });

  it('rejects missing public supabase config', () => {
    expect(() => parsePublicSupabaseConfig({ url: '', anonKey: 'x' })).toThrow(/Missing Supabase URL/);
    expect(() =>
      parsePublicSupabaseConfig({ url: 'http://127.0.0.1:54321', anonKey: '' }),
    ).toThrow(/Missing Supabase anon/);
  });

  it('rejects database URLs and service-role keys', () => {
    expect(() =>
      parsePublicSupabaseConfig({
        url: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
        anonKey: 'anon',
      }),
    ).toThrow(/Database connection strings/);
    expect(() =>
      parsePublicSupabaseConfig({
        url: 'http://127.0.0.1:54321',
        anonKey: 'service_role_secret',
      }),
    ).toThrow(/Service-role keys are forbidden/);
  });
});
