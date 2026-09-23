/** Service area module view-model — matches public.service_areas + PIN_CODE rules. */

export type ServiceAreaStatus = 'active' | 'inactive';

export type ServiceAreaListItem = {
  id: string;
  name: string;
  description: string;
  status: ServiceAreaStatus;
  displayOrder: number;
  pinCodes: string[];
  pinCount: number;
  pinRuleId: string | null;
};
