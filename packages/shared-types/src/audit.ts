import type { StaffRole } from './enums';

export interface AuditLog {
  id: string;
  actorProfileId?: string;
  actorRole?: StaffRole;
  action: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}
