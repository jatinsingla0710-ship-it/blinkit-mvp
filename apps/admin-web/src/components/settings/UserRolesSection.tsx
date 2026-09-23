import type { UserRoleRow } from '@/data/settings-types';
import { RolesPermissionsMatrix } from '@/components/settings/RolesPermissionsMatrix';

type Props = {
  /** @deprecated Phase 1 ignores fixture/live snapshot rows; matrix is static auth truth. */
  rows?: UserRoleRow[];
};

/**
 * Settings → Roles — read-only permission matrix (Phase 1).
 * Create/edit/delete roles is intentionally not offered.
 */
export function UserRolesSection(_props: Props) {
  return <RolesPermissionsMatrix />;
}
