import { describe, expect, it, beforeAll } from 'vitest';
import {
  createSupabaseCatalogueService,
  createSupabaseServiceAreaService,
  evaluateServiceabilityRules,
  parseCustomerDataAdapterMode,
  resolveCustomerSession,
  selectEffectiveSkuPrice,
  type GroAurumSupabaseClient,
} from '@groaurum/api-client';
import { getPool, setDbTestConfig, withUserClient } from '../src/client';
import { loadDbTestConfig } from '../src/env';
import {
  createAuthUser,
  insertMinimalCatalogue,
  insertServiceArea,
  insertShop,
  linkShopAuth,
  type TestUser,
} from '../src/fixtures';

beforeAll(() => {
  process.env.GROAURUM_DB_TEST_ALLOWED ??= 'true';
  setDbTestConfig(loadDbTestConfig());
});

function asTyped(client: Parameters<Parameters<typeof withUserClient>[1]>[0]) {
  return client as unknown as GroAurumSupabaseClient;
}

async function withSession(
  user: TestUser,
  fn: (client: GroAurumSupabaseClient) => Promise<void>,
) {
  await withUserClient(
    user.accessToken,
    async (client) => {
      await fn(asTyped(client));
    },
    { refreshToken: user.refreshToken },
  );
}

describe('Phase 3 adapter mode', () => {
  it('validates mock vs supabase and rejects invalid', () => {
    expect(parseCustomerDataAdapterMode('mock')).toBe('mock');
    expect(parseCustomerDataAdapterMode('supabase')).toBe('supabase');
    expect(() => parseCustomerDataAdapterMode('hybrid')).toThrow(
      /Invalid customer data adapter mode/,
    );
  });
});

describe('Phase 3 auth/shop resolution (live)', () => {
  it('unauthenticated session is explicit', async () => {
    const config = loadDbTestConfig();
    const { createClient } = await import('@supabase/supabase-js');
    const anon = createClient(config.supabaseUrl, config.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const snapshot = await resolveCustomerSession(asTyped(anon));
    expect(snapshot.phase).toBe('UNAUTHENTICATED');
  });

  it('authenticated user without shop link returns AUTHENTICATED_NO_SHOP_LINK', async () => {
    const user = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `9801${Math.floor(Math.random() * 1e6)
        .toString()
        .padStart(6, '0')}`,
    });

    await withSession(user, async (client) => {
      const snapshot = await resolveCustomerSession(client);
      expect(snapshot.phase).toBe('AUTHENTICATED_NO_SHOP_LINK');
      expect(snapshot.shopContext).toBeNull();
    });
  });

  it('authenticated user with shop link resolves own shop only', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'P3 Shop');
    await pool.query(
      `INSERT INTO public.serviceability_rules (service_area_id, rule_type, config)
       VALUES ($1, 'PIN_CODE', '{"pinCodes":["110017"]}'::jsonb)`,
      [serviceAreaId],
    );

    const customer = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `9802${Math.floor(Math.random() * 1e6)
        .toString()
        .padStart(6, '0')}`,
    });
    const other = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `9803${Math.floor(Math.random() * 1e6)
        .toString()
        .padStart(6, '0')}`,
    });

    const shopA = await insertShop(pool, { serviceAreaId, pinCode: '110017' });
    const shopB = await insertShop(pool, { serviceAreaId, pinCode: '110017' });
    await linkShopAuth(pool, shopA, customer.id);
    await linkShopAuth(pool, shopB, other.id);

    await withSession(customer, async (client) => {
      const snapshot = await resolveCustomerSession(client);
      expect(snapshot.phase).toBe('LINKED_SHOP_READY');
      expect(snapshot.shopContext?.shop.id).toBe(shopA);
      expect(snapshot.shopContext?.shop.id).not.toBe(shopB);
      expect(snapshot.serviceability?.serviceable).toBe(true);
      expect(snapshot.serviceability?.status).toBe('SERVICEABLE');
    });
  });

  it('inactive shop is handled explicitly', async () => {
    const pool = getPool();
    const serviceAreaId = await insertServiceArea(pool, 'P3 Inactive Shop');
    await pool.query(
      `INSERT INTO public.serviceability_rules (service_area_id, rule_type, config)
       VALUES ($1, 'PIN_CODE', '{"pinCodes":["110020"]}'::jsonb)`,
      [serviceAreaId],
    );

    const customer = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `9805${Math.floor(Math.random() * 1e6)
        .toString()
        .padStart(6, '0')}`,
    });
    const shopId = await insertShop(pool, { serviceAreaId, pinCode: '110020' });
    await pool.query(`UPDATE public.shops SET is_active = false WHERE id = $1`, [shopId]);
    await linkShopAuth(pool, shopId, customer.id);

    await withSession(customer, async (client) => {
      const snapshot = await resolveCustomerSession(client);
      expect(snapshot.phase).toBe('LINKED_SHOP_INACTIVE_OR_BLOCKED');
      expect(snapshot.shopContext?.shop.id).toBe(shopId);
    });
  });
});

describe('Phase 3 serviceability adapter (live)', () => {
  it('active matching PIN_CODE rule is serviceable; inactive area is not', async () => {
    const pool = getPool();
    const activeArea = await insertServiceArea(pool, 'P3 Active SA', true);
    const inactiveArea = await insertServiceArea(pool, 'P3 Inactive SA', false);

    await pool.query(
      `INSERT INTO public.serviceability_rules (service_area_id, rule_type, is_active, config)
       VALUES
         ($1, 'PIN_CODE', true, '{"pinCodes":["110024"]}'::jsonb),
         ($2, 'PIN_CODE', true, '{"pinCodes":["110024"]}'::jsonb)`,
      [activeArea, inactiveArea],
    );

    const customer = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `9806${Math.floor(Math.random() * 1e6)
        .toString()
        .padStart(6, '0')}`,
    });

    await withSession(customer, async (client) => {
      const service = createSupabaseServiceAreaService(client);
      const ok = await service.evaluateServiceability({ pinCode: '110024' });
      expect(ok.status).toBe('SERVICEABLE');
      expect(ok.serviceArea?.id).toBe(activeArea);

      const miss = await service.evaluateServiceability({ pinCode: '999999' });
      expect(miss.status).toBe('NOT_SERVICEABLE');

      const insufficient = await service.evaluateServiceability({});
      expect(insufficient.status).toBe('INSUFFICIENT_ADDRESS_DATA');
    });
  });

  it('inactive rule does not grant serviceability', async () => {
    const pool = getPool();
    const areaId = await insertServiceArea(pool, 'P3 Inactive Rule');
    await pool.query(
      `INSERT INTO public.serviceability_rules (service_area_id, rule_type, is_active, config)
       VALUES ($1, 'PIN_CODE', false, '{"pinCodes":["122011"]}'::jsonb)`,
      [areaId],
    );

    const customer = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `9807${Math.floor(Math.random() * 1e6)
        .toString()
        .padStart(6, '0')}`,
    });

    await withSession(customer, async (client) => {
      const service = createSupabaseServiceAreaService(client);
      const result = await service.evaluateServiceability({ pinCode: '122011' });
      // Inactive rules are hidden by RLS for non-admins, so no match.
      expect(result.status).toBe('NOT_SERVICEABLE');
    });
  });
});

describe('Phase 3 catalogue adapter (live)', () => {
  it('SKU without current price is not exposed as orderable', async () => {
    const pool = getPool();
    const { skuId } = await insertMinimalCatalogue(pool);
    const customer = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `9808${Math.floor(Math.random() * 1e6)
        .toString()
        .padStart(6, '0')}`,
    });

    await withSession(customer, async (client) => {
      const catalogue = createSupabaseCatalogueService(client);
      const price = await catalogue.getEffectiveSkuPrice(skuId);
      expect(price).toBeNull();
      const sku = await catalogue.getSkuById(skuId);
      expect(sku).toBeNull();
    });
  });

  it('exposes active priced SKU; hides inactive category chain; respects price window', async () => {
    const pool = getPool();
    const admin = await createAuthUser({
      roles: ['ADMIN'],
      mobile: `9804${Math.floor(Math.random() * 1e6)
        .toString()
        .padStart(6, '0')}`,
    });
    const customer = await createAuthUser({
      roles: ['CUSTOMER'],
      mobile: `9809${Math.floor(Math.random() * 1e6)
        .toString()
        .padStart(6, '0')}`,
    });
    const { skuId, productId, categoryId } = await insertMinimalCatalogue(pool);

    await pool.query(
      `INSERT INTO public.sku_prices (sku_id, trade_price, recorded_by_profile_id)
       VALUES ($1, 199, $2)`,
      [skuId, admin.id],
    );

    await withSession(customer, async (client) => {
      const catalogue = createSupabaseCatalogueService(client);
      const products = await catalogue.getProducts({ activeOnly: true });
      expect(products.some((p) => p.id === productId)).toBe(true);

      const skus = await catalogue.getSkusByProductId(productId);
      expect(skus.some((s) => s.id === skuId)).toBe(true);

      const price = await catalogue.getEffectiveSkuPrice(skuId);
      expect(price?.tradePrice).toBe(199);
    });

    expect(
      selectEffectiveSkuPrice(
        [
          {
            id: 'x',
            sku_id: skuId,
            trade_price: 1,
            currency: 'INR',
            effective_from: '2099-01-01T00:00:00Z',
            effective_to: null,
            created_at: '2099-01-01T00:00:00Z',
          },
        ],
        new Date('2026-06-01T00:00:00Z'),
      ),
    ).toBeNull();

    await pool.query(`UPDATE public.categories SET is_active = false WHERE id = $1`, [
      categoryId,
    ]);

    await withSession(customer, async (client) => {
      const catalogue = createSupabaseCatalogueService(client);
      const productsAfter = await catalogue.getProducts({ activeOnly: true });
      expect(productsAfter.some((p) => p.id === productId)).toBe(false);
    });
  });
});

describe('Phase 3 serviceability pure rules', () => {
  it('matches docs for inactive area and missing pin', () => {
    const result = evaluateServiceabilityRules(
      [
        {
          id: 'a1',
          name: 'A',
          isActive: false,
          displayOrder: 0,
          createdAt: '',
          updatedAt: '',
        },
      ],
      [
        {
          id: 'r1',
          serviceAreaId: 'a1',
          ruleType: 'PIN_CODE',
          isActive: true,
          config: { ruleType: 'PIN_CODE', pinCodes: ['110017'] },
          createdAt: '',
          updatedAt: '',
        },
      ],
      { pinCode: '110017' },
    );
    expect(result.status).toBe('NOT_SERVICEABLE');
    expect(evaluateServiceabilityRules([], [], {}).status).toBe(
      'INSUFFICIENT_ADDRESS_DATA',
    );
  });
});
