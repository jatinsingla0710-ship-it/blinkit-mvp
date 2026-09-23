import type { CustomerDocumentRow } from '@/data/customers-types';
import { CUSTOMER_DOCUMENTS_UNAVAILABLE_DETAIL } from '@/data/customers-helpers';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  rows: CustomerDocumentRow[];
  /** No documents table in schema — show deferred copy when empty. */
  deferred?: boolean;
};

export function CustomerDocumentsTab({ rows, deferred = false }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={deferred ? 'Documents not available' : 'No documents'}
        detail={
          deferred
            ? CUSTOMER_DOCUMENTS_UNAVAILABLE_DETAIL
            : 'Uploaded customer files will appear here when a document store exists.'
        }
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Type</th>
            <th>Status</th>
            <th>Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="ga-table__primary">{row.name}</span>
              </td>
              <td>{row.typeLabel}</td>
              <td>
                <Badge tone="neutral">{row.statusLabel}</Badge>
              </td>
              <td>{row.uploadedAtLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
