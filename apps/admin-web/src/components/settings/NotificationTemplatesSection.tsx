import type { NotificationTemplateRow } from '@/data/settings-types';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import '@groaurum/ui/styles/data-table.css';

type Props = {
  rows: NotificationTemplateRow[];
};

export function NotificationTemplatesSection({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No templates"
        detail="Notification templates will appear here."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Channel</th>
            <th>Template</th>
            <th>Preview</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Badge tone="info">{row.channelLabel}</Badge>
              </td>
              <td className="ga-table__primary">{row.templateName}</td>
              <td>{row.subjectLabel}</td>
              <td>{row.statusLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
