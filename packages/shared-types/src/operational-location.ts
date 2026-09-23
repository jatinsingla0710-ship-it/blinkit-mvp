import type { OperationalLocationKind } from './enums';

/** Physical ops location such as the Fatehpur Beri base — not a consumer dark store. */
export interface OperationalLocation {
  id: string;
  name: string;
  kind: OperationalLocationKind;
  addressLine: string;
  city: string;
  state: string;
  pinCode: string;
  lat?: number;
  lng?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
