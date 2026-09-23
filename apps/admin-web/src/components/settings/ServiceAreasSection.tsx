import { Link } from 'react-router-dom';
import type { ServiceAreaRow } from '@/data/settings-types';
import { SettingsStatusBadge } from '@/components/settings/SettingsStatusBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';
import './SettingsTableActions.css';

type Props = {
  rows: ServiceAreaRow[];
  onAdd?: () => void;
};

export function ServiceAreasSection({ rows, onAdd }: Props) {
  return (
    <div className="ga-st-table-block">
      <div className="ga-st-table-block__toolbar">
        {onAdd ? (
          <Button variant="primary" onClick={onAdd}>
            Manage Service Areas
          </Button>
        ) : (
          <Link to="/service-areas">
            <Button variant="primary">Manage Service Areas</Button>
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No service areas"
          detail="Define delivery territories and PIN_CODE rules."
        />
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>PIN count</th>
                <th>PIN codes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="ga-table__primary">{row.name}</td>
                  <td>{row.description || '—'}</td>
                  <td>{row.pinCount}</td>
                  <td>
                    {row.pinCodes.length > 0 ? row.pinCodes.join(', ') : '—'}
                  </td>
                  <td>
                    <SettingsStatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
