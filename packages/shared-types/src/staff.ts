import type { StaffRole } from './enums';

export interface StaffProfile {
  id: string;
  authUserId: string;
  displayName: string;
  mobile: string;
  roles: StaffRole[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
