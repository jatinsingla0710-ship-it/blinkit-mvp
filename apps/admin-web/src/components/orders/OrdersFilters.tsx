import type { OrdersFilterState, OrdersSnapshot, OrdersSortId } from '@/data/orders-types';
import { Button, FilterBar, SelectField, TextField } from '@groaurum/ui';
import './OrdersFilters.css';

type Props = {
  filters: OrdersFilterState;
  sort: OrdersSortId;
  options: OrdersSnapshot['filterOptions'];
  onChange: (next: OrdersFilterState) => void;
  onSortChange: (sort: OrdersSortId) => void;
  onReset: () => void;
};

/**
 * Compact filter strip — search lives in the page header.
 */
export function OrdersFilters({
  filters,
  sort,
  options,
  onChange,
  onSortChange,
  onReset,
}: Props) {
  return (
    <div className="ga-orders-filters">
      <FilterBar columns="repeat(auto-fit, minmax(140px, 1fr))">
        <TextField
          label="Date"
          type="date"
          value={filters.date}
          onChange={(e) => onChange({ ...filters, date: e.target.value })}
        />
        <SelectField
          label="Sort"
          value={sort}
          onChange={(value) => onSortChange(value as OrdersSortId)}
        >
          <option value="placed_desc">Newest first</option>
          <option value="placed_asc">Oldest first</option>
          <option value="amount_desc">Amount high → low</option>
          <option value="amount_asc">Amount low → high</option>
          <option value="customer_asc">Customer A → Z</option>
        </SelectField>
        <SelectField
          label="Order Status"
          value={filters.status}
          onChange={(status) => onChange({ ...filters, status })}
        >
          {options.statuses.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Payment"
          value={filters.payment}
          onChange={(payment) => onChange({ ...filters, payment })}
        >
          {options.payments.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Salesman"
          value={filters.salesman}
          onChange={(salesman) => onChange({ ...filters, salesman })}
        >
          {options.salesmen.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>
      </FilterBar>
      <Button variant="ghost" onClick={onReset}>
        Reset filters
      </Button>
    </div>
  );
}
