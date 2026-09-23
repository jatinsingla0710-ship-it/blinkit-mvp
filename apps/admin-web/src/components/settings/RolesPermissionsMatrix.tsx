import { useMemo } from 'react';
import {
  buildRolePermissionMatrix,
  type AppRole,
  type RoleMatrixRow,
} from '@groaurum/auth';
import './RolesPermissionsMatrix.css';

function formatRoleLabel(role: AppRole): string {
  return role.replace(/_/g, ' ');
}

function RoleSourceBadge({ row }: { row: RoleMatrixRow }) {
  if (row.source === 'live_supabase') {
    return (
      <span className="ga-roles-matrix__badge ga-roles-matrix__badge--live">
        Live Supabase
        {row.staffRoles.length > 0
          ? ` · ${row.staffRoles.join(', ')}`
          : ''}
      </span>
    );
  }
  return (
    <span className="ga-roles-matrix__badge ga-roles-matrix__badge--frontend">
      Frontend-only · not assignable in live DB
    </span>
  );
}

/**
 * Read-only Admin RBAC matrix — Phase 1 honest view.
 * No create/edit/delete; sourced from AppRole constants.
 */
export function RolesPermissionsMatrix() {
  const matrix = useMemo(() => buildRolePermissionMatrix(), []);

  return (
    <div className="ga-roles-matrix">
      <p className="ga-roles-matrix__notice">{matrix.notice}</p>

      <div className="ga-table-wrap">
        <table className="ga-table ga-roles-matrix__table">
          <thead>
            <tr>
              <th>App role</th>
              <th>Source</th>
              <th>Admin modules</th>
              <th>Permissions</th>
            </tr>
          </thead>
          <tbody>
            {matrix.roles.map((row) => (
              <tr key={row.role}>
                <td className="ga-table__primary">
                  <code>{row.role}</code>
                  <div className="ga-roles-matrix__label">
                    {formatRoleLabel(row.role)}
                  </div>
                </td>
                <td>
                  <RoleSourceBadge row={row} />
                </td>
                <td>
                  {row.modules.length > 0 ? (
                    <ul className="ga-roles-matrix__list">
                      {row.modules.map((module) => (
                        <li key={module}>
                          <code>{module}</code>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="ga-roles-matrix__muted">
                      No Admin ERP modules
                    </span>
                  )}
                </td>
                <td>
                  <ul className="ga-roles-matrix__list">
                    {row.permissions.map((permission) => (
                      <li key={permission}>
                        <code>{permission}</code>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
