import type { CustomerAddressRow } from '@/data/customers-types';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  rows: CustomerAddressRow[];
};

export function CustomerAddressesTab({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No addresses"
        detail="Delivery addresses for this shop will appear here."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Address</th>
            <th>Role</th>
            <th>Serviceable</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="ga-table__primary">{row.label}</span>
              </td>
              <td>{row.text}</td>
              <td>
                <Badge tone={row.isPrimary ? 'success' : 'neutral'}>
                  {row.isPrimary ? 'Primary' : 'Secondary'}
                </Badge>
              </td>
              <td>
                <Badge tone={row.serviceable ? 'success' : 'danger'}>
                  {row.serviceable ? 'Yes' : 'No'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
