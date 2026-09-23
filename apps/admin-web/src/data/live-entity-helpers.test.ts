import { describe, expect, it } from 'vitest';
import {
  activeSalesmen,
  activeServiceAreas,
  pinBelongsToServiceArea,
} from './live-entity-helpers';
import type { ServiceAreaListItem } from './service-area-model';
import type { SalesmanListRow } from './salesmen-types';

const AREAS: ServiceAreaListItem[] = [
  {
    id: 'area-1',
    name: 'South Delhi',
    description: '',
    status: 'active',
    displayOrder: 0,
    pinCodes: ['110017'],
    pinCount: 1,
    pinRuleId: null,
  },
  {
    id: 'area-2',
    name: 'Inactive Area',
    description: '',
    status: 'inactive',
    displayOrder: 1,
    pinCodes: ['110074'],
    pinCount: 1,
    pinRuleId: null,
  },
];

const SALESMEN: SalesmanListRow[] = [
  {
    id: 'sm-1',
    name: 'Priya',
    territory: 'South Delhi',
    assignedCustomers: 1,
    ordersThisMonth: 1,
    collectionsLabel: '₹1',
    status: 'active',
    updatedAtLabel: 'Today',
  },
  {
    id: 'sm-2',
    name: 'Vikram',
    territory: 'East Delhi',
    assignedCustomers: 0,
    ordersThisMonth: 0,
    collectionsLabel: '₹0',
    status: 'inactive',
    updatedAtLabel: 'Yesterday',
  },
];

describe('live entity helpers', () => {
  it('filters active service areas and salesmen', () => {
    expect(activeServiceAreas(AREAS).map((area) => area.id)).toEqual(['area-1']);
    expect(activeSalesmen(SALESMEN).map((row) => row.id)).toEqual(['sm-1']);
  });

  it('checks whether a PIN belongs to the selected service area', () => {
    expect(pinBelongsToServiceArea(AREAS[0], '110017')).toBe(true);
    expect(pinBelongsToServiceArea(AREAS[0], '110074')).toBe(false);
    expect(pinBelongsToServiceArea(AREAS[0], '11007')).toBe(false);
  });
});
