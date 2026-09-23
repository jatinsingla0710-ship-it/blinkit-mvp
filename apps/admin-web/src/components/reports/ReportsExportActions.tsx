import type { ExportFormat } from '@/data/reports-types';
import { ActionBar, Button } from '@groaurum/ui';

type Props = {
  onExport?: (format: ExportFormat) => void;
};

export function ReportsExportActions({ onExport }: Props) {
  return (
    <ActionBar>
      <Button variant="secondary" onClick={() => onExport?.('pdf')}>
        Export PDF
      </Button>
      <Button variant="secondary" onClick={() => onExport?.('excel')}>
        Export Excel
      </Button>
      <Button variant="secondary" onClick={() => onExport?.('csv')}>
        Export CSV
      </Button>
    </ActionBar>
  );
}
