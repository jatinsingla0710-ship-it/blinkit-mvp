import type {
  ReportsFilterOptions,
  ReportsFilterState,
} from '@/data/reports-types';
import { Card, FilterBar, SelectField } from '@groaurum/ui';

type Props = {
  state: ReportsFilterState;
  options: ReportsFilterOptions;
  onChange: (next: ReportsFilterState) => void;
};

export function ReportsFilters({ state, options, onChange }: Props) {
  return (
    <Card title="Filters">
      <FilterBar columns="repeat(6, minmax(0, 1fr))">
        <SelectField
          label="Date Range"
          value={state.dateRange}
          onChange={(dateRange) => onChange({ ...state, dateRange })}
        >
          {options.dateRanges.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Category"
          value={state.category}
          onChange={(category) => onChange({ ...state, category })}
        >
          {options.categories.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Area"
          value={state.area}
          onChange={(area) => onChange({ ...state, area })}
        >
          {options.areas.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Salesman"
          value={state.salesman}
          onChange={(salesman) => onChange({ ...state, salesman })}
        >
          {options.salesmen.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Warehouse"
          value={state.warehouse}
          onChange={(warehouse) => onChange({ ...state, warehouse })}
        >
          {options.warehouses.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Customer"
          value={state.customer}
          onChange={(customer) => onChange({ ...state, customer })}
        >
          {options.customers.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>
      </FilterBar>
    </Card>
  );
}
