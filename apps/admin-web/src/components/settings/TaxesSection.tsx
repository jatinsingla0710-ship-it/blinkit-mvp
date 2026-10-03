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
        title="No tax mappings yet"
        detail="Set HSN and GST % on product SKUs. Mappings appear here for reference — this is not a GSTR filing tool."
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
