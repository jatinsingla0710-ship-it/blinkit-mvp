import type { ServiceAreaListItem } from '@/data/service-area-model';

/** Mock-mode service areas — layout only; writes require the Supabase adapter. */
export const SERVICE_AREA_LIST_FIXTURE: ServiceAreaListItem[] = [
  {
    id: 'a2000000-0000-4000-8000-000000000001',
    name: 'South Delhi',
    description:
      'GroAurum launch service area — South Delhi grocery + FMCG wholesale',
    status: 'active',
    displayOrder: 0,
    pinCodes: [
      '110017',
      '110019',
      '110020',
      '110024',
      '110048',
      '110062',
      '110074',
    ],
    pinCount: 7,
    pinRuleId: 'a1400000-0000-4000-8000-000000000001',
  },
];
