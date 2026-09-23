/**
 * Reports & Analytics v1 view models.
 * Executive analytics center — ready for Supabase / warehouse queries later.
 * Every report answers a business decision question.
 */

export type ReportsSectionId =
  | 'sales'
  | 'products'
  | 'customers'
  | 'salesmen'
  | 'delivery'
  | 'inventory';

export type ChartKind = 'bar' | 'line' | 'donut' | 'table';

export type ExportFormat = 'pdf' | 'excel' | 'csv';

export interface ReportsKpi {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}

export interface ReportsFilterOption {
  value: string;
  label: string;
}

export interface ReportsFilterState {
  dateRange: string;
  category: string;
  area: string;
  salesman: string;
  warehouse: string;
  customer: string;
}

export interface ReportsFilterOptions {
  dateRanges: ReportsFilterOption[];
  categories: ReportsFilterOption[];
  areas: ReportsFilterOption[];
  salesmen: ReportsFilterOption[];
  warehouses: ReportsFilterOption[];
  customers: ReportsFilterOption[];
}

/** Placeholder chart series — visual only until live analytics. */
export interface ChartSeriesPoint {
  label: string;
  value: number;
  displayValue?: string;
}

export interface ReportMetricCard {
  id: string;
  title: string;
  /** Business question this report answers. */
  question: string;
  value?: string;
  hint?: string;
  chartKind: ChartKind;
  series?: ChartSeriesPoint[];
  rows?: ReportTableRow[];
  columns?: string[];
  /** Legacy fixture flag — live path must not invent placeholder metrics. */
  placeholder?: boolean;
  /** Honest empty / not-available copy when there is no live series or rows. */
  emptyDetail?: string;
  /** Section is not backed by converted sales (or other live source) yet. */
  unavailable?: boolean;
}

export interface ReportTableRow {
  id: string;
  cells: string[];
}

export interface ReportsSection {
  id: ReportsSectionId;
  label: string;
  intro: string;
  reports: ReportMetricCard[];
}

export interface ReportsSnapshot {
  generatedAtLabel: string;
  kpis: ReportsKpi[];
  filterOptions: ReportsFilterOptions;
  defaultFilters: ReportsFilterState;
  sections: ReportsSection[];
}
