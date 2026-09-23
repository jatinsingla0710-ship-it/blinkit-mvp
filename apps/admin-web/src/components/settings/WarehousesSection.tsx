import { Link } from 'react-router-dom';
import type { WarehouseRow } from '@/data/settings-types';
import { SettingsStatusBadge } from '@/components/settings/SettingsStatusBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';
import './SettingsTableActions.css';

type Props = {
  rows: WarehouseRow[];
  onAdd?: () => void;
};

export function WarehousesSection({ rows, onAdd }: Props) {
  return (
    <div className="ga-st-table-block">
      <div className="ga-st-table-block__toolbar">
        {onAdd ? (
          <Button variant="primary" onClick={onAdd}>
            Manage Warehouses
          </Button>
        ) : (
          <Link to="/warehouses">
            <Button variant="primary">Manage Warehouses</Button>
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No warehouses"
          detail="Add a warehouse to begin inventory and dispatch."
        />
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>City</th>
                <th>State</th>
                <th>PIN</th>
                <th>Address</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="ga-table__primary">{row.name}</td>
                  <td>{row.city}</td>
                  <td>{row.state}</td>
                  <td className="ga-table__mono">{row.pinCode}</td>
                  <td>{row.addressLine}</td>
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
