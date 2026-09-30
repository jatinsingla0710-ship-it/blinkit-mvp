import { useMemo, useState } from 'react';
import type {
  ReportsFilterState,
  ReportsSectionId,
} from '@/data/reports-types';
import { ReportsFilters } from '@/components/reports/ReportsFilters';
import { ReportsSectionGrid } from '@/components/reports/ReportsSectionGrid';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useReportsSnapshotQuery } from '@/data/hooks';
import './ReportsPage.css';

const TABS: TabItem<ReportsSectionId>[] = [
  { id: 'sales', label: 'Sales' },
  { id: 'products', label: 'Products' },
  { id: 'customers', label: 'Customers' },
  { id: 'salesmen', label: 'Salesmen' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'inventory', label: 'Inventory' },
];

/**
 * Reports — sales KPIs and tables from converted sales records.
 * Filters are display-only until scoped queries are implemented.
 * Export is not available (no report export backend).
 */
export function ReportsPage() {
  const { state } = useReportsSnapshotQuery();
  const [section, setSection] = useState<ReportsSectionId>('sales');
  const [filters, setFilters] = useState<ReportsFilterState | null>(null);

  const activeSection = useMemo(() => {
    if (!state.data) return null;
    return (
      state.data.sections.find((s) => s.id === section) ?? state.data.sections[0]
    );
  }, [state.data, section]);

  return (
    <QueryStateGate title="Reports" state={state}>
      {(snapshot) => {
        const activeFilters = filters ?? snapshot.defaultFilters;
        const sectionData =
          activeSection ??
          snapshot.sections.find((s) => s.id === section) ??
          snapshot.sections[0];

        return (
          <div className="ga-rp-page">
            <PageHeader
              title="Reports"
              subtitle="Sales performance from completed invoices"
              meta={snapshot.generatedAtLabel}
            />

            <KpiCards items={snapshot.kpis} />

            <Card title="Export">
              <p className="ga-rp-page__export-note">
                Export PDF / Excel / CSV is not available — there is no report
                export backend yet.
              </p>
            </Card>

            <Card title="Filters">
              <p className="ga-rp-page__export-note">
                Filter controls below are not applied to live KPIs yet. Values
                shown are all-time converted sales.
              </p>
              <ReportsFilters
                state={activeFilters}
                options={snapshot.filterOptions}
                onChange={setFilters}
              />
            </Card>

            <Card className="ga-rp-page__main">
              <Tabs items={TABS} active={section} onChange={setSection} />
              <div className="ga-rp-page__panel">
                <ReportsSectionGrid section={sectionData} />
              </div>
            </Card>
          </div>
        );
      }}
    </QueryStateGate>
  );
}
