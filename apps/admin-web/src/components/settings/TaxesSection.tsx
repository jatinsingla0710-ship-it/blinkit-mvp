import type { TaxConfigRow } from '@/data/settings-types';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  rows: TaxConfigRow[];
};

export function TaxesSection({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No tax mappings"
        detail="GST and HSN mappings by category will appear here."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Category Mapping</th>
            <th>GST %</th>
            <th>HSN Code</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="ga-table__primary">{row.categoryLabel}</td>
              <td>{row.gstPercentLabel}</td>
              <td className="ga-table__mono">{row.hsnCode}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
