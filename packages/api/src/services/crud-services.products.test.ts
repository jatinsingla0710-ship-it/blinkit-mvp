import { describe, expect, it, vi } from 'vitest';
import { createDataError } from '@groaurum/data';
import { CrudServices } from './crud-services';
import type { DomainCrudRepositories } from '../repositories/supabase/create-supabase-domain-repositories';

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const SKU_ID = '33333333-3333-4333-8333-333333333333';

function createServices(overrides: Partial<DomainCrudRepositories>) {
  const repos = {
    products: {
      create: vi.fn().mockResolvedValue({ id: PRODUCT_ID }),
      update: vi.fn().mockResolvedValue({ id: PRODUCT_ID }),
    },
    categories: {
      create: vi.fn().mockResolvedValue({ id: CATEGORY_ID, name: 'Atta' }),
      ensureByName: vi.fn().mockResolvedValue({ id: CATEGORY_ID, name: 'Atta' }),
    },
    skus: {
      create: vi.fn().mockResolvedValue({ id: SKU_ID }),
      update: vi.fn().mockResolvedValue({ id: SKU_ID }),
    },
    ...overrides,
  };
  return {
    services: new CrudServices(repos as unknown as DomainCrudRepositories),
    repos,
  };
}

describe('CrudServices catalogue methods', () => {
  it('rejects invalid product input before calling the repository', () => {
    const { services, repos } = createServices({});
    expect(() =>
      services.createProduct({
        categoryId: CATEGORY_ID,
        name: '   ',
        productType: 'BULK',
      }),
    ).toThrow();
    expect(repos.products.create).not.toHaveBeenCalled();
  });

  it('creates a product after validation', async () => {
    const { services, repos } = createServices({});
    await services.createProduct({
      categoryId: CATEGORY_ID,
      name: 'Akhrot Giri',
      productType: 'BULK',
      isActive: true,
    });
    expect(repos.products.create).toHaveBeenCalledWith({
      categoryId: CATEGORY_ID,
      name: 'Akhrot Giri',
      productType: 'BULK',
      isActive: true,
    });
  });

  it('ensureCategory reuses existing category via repository', async () => {
    const { services, repos } = createServices({});
    const row = await services.ensureCategory('Atta');
    expect(repos.categories.ensureByName).toHaveBeenCalledWith('Atta', true);
    expect(row.id).toBe(CATEGORY_ID);
  });

  it('rejects empty ensureCategory name', () => {
    const { services } = createServices({});
    expect(() => services.ensureCategory('   ')).toThrow();
  });

  it('surfaces duplicate product name in category from repository', async () => {
    const { services, repos } = createServices({
      products: {
        create: vi.fn().mockRejectedValue(
          createDataError(
            'unexpected',
            'A product with this name already exists in the selected category',
          ),
        ),
        update: vi.fn(),
      },
    });
    await expect(
      services.createProduct({
        categoryId: CATEGORY_ID,
        name: 'Atta',
        productType: 'PACKED',
      }),
    ).rejects.toMatchObject({
      message: 'A product with this name already exists in the selected category',
    });
    expect(repos.products.create).toHaveBeenCalled();
  });

  it('rejects invalid SKU input before calling the repository', () => {
    const { services, repos } = createServices({});
    expect(() =>
      services.createSku({
        productId: PRODUCT_ID,
        skuCode: '   ',
        name: 'SKU',
        productType: 'BULK',
        sellingUnit: 'KG',
      }),
    ).toThrow();
    expect(repos.skus.create).not.toHaveBeenCalled();
  });

  it('creates a SKU after validation', async () => {
    const { services, repos } = createServices({});
    await services.createSku({
      productId: PRODUCT_ID,
      skuCode: 'AKH-LA-10',
      name: 'Light Amber 10 KG',
      productType: 'BULK',
      sellingUnit: 'KG',
      moq: 10,
      quantityStep: 10,
    });
    expect(repos.skus.create).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      skuCode: 'AKH-LA-10',
      name: 'Light Amber 10 KG',
      productType: 'BULK',
      sellingUnit: 'KG',
      moq: 10,
      quantityStep: 10,
    });
  });
});
