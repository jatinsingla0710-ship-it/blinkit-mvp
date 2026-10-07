import type { UserRoleRow } from '@/data/settings-types';
import { RolesPermissionsMatrix } from '@/components/settings/RolesPermissionsMatrix';
import { SecurityHonestyPanel } from '@/components/settings/SecurityHonestyPanel';

type Props = {
  /** @deprecated Phase 1 ignores fixture/live snapshot rows; matrix is static auth truth. */
  rows?: UserRoleRow[];
};

/**
 * Settings → Roles — security honesty (Phase 24) + read-only permission matrix.
 * Create/edit/delete roles is intentionally not offered.
 */
export function UserRolesSection(_props: Props) {
  return (
    <>
      <SecurityHonestyPanel />
      <RolesPermissionsMatrix />
    </>
  );
}
