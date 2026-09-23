import { describe, expect, it } from 'vitest';
import { buildPublishChecklist, isPublishReady } from './publish';

describe('buildPublishChecklist', () => {
  it('marks image and inventory as optional', () => {
    const checklist = buildPublishChecklist({
      hasCategory: true,
      hasImage: false,
      hasSku: true,
      hasCurrentPrice: true,
      hasMoq: true,
      hasSellingUnit: true,
      hasInventory: false,
    });

    expect(checklist.find((item) => item.key === 'image')?.optional).toBe(true);
    expect(checklist.find((item) => item.key === 'inventory')?.optional).toBe(true);
    expect(checklist.find((item) => item.key === 'sku')?.optional).toBeFalsy();
  });

  it('allows publish when only optional items are missing', () => {
    const checklist = buildPublishChecklist({
      hasCategory: true,
      hasImage: false,
      hasSku: true,
      hasCurrentPrice: true,
      hasMoq: true,
      hasSellingUnit: true,
      hasInventory: false,
    });

    expect(isPublishReady(checklist)).toBe(true);
  });

  it('blocks publish when required price or sku is missing', () => {
    const missingPrice = buildPublishChecklist({
      hasCategory: true,
      hasImage: true,
      hasSku: true,
      hasCurrentPrice: false,
      hasMoq: true,
      hasSellingUnit: true,
      hasInventory: true,
    });
    const missingSku = buildPublishChecklist({
      hasCategory: true,
      hasImage: true,
      hasSku: false,
      hasCurrentPrice: false,
      hasMoq: false,
      hasSellingUnit: false,
      hasInventory: false,
    });

    expect(isPublishReady(missingPrice)).toBe(false);
    expect(isPublishReady(missingSku)).toBe(false);
  });
});
