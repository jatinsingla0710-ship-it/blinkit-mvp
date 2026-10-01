import type { SalesmanBrowseState, SalesmanSortId } from '@/data/salesmen-types';
import { EMPTY_SALESMAN_BROWSE } from '@/data/browse-helpers';
import {
  Button,
  Card,
  ChipGroup,
  FilterBar,
  SelectField,
  TextField,
} from '@groaurum/ui';

type Props = {
  state: SalesmanBrowseState;
  onChange: (next: SalesmanBrowseState) => void;
};

const SORT_OPTIONS: { id: SalesmanSortId; label: string }[] = [
  { id: 'name_az', label: 'A–Z' },
  { id: 'orders_desc', label: 'Orders' },
  { id: 'customers_desc', label: 'Customers' },
  { id: 'updated_desc', label: 'Updated' },
];

export function SalesmenBrowseBar({ state, onChange }: Props) {
  return (
    <Card
      title="Search · Filter · Sort"
      action={
        <Button
          variant="secondary"
          onClick={() => onChange({ ...EMPTY_SALESMAN_BROWSE })}
        >
          Reset filters
        </Button>
      }
    >
      <FilterBar>
        <TextField
          label="Search"
          type="search"
          grow
          placeholder="Salesman or territory..."
          value={state.query}
          onChange={(e) =>
            onChange({ ...state, query: e.target.value, page: 1 })
          }
        />
        <SelectField
          label="Status"
          value={state.status}
          onChange={(status) =>
            onChange({
              ...state,
              status: status as SalesmanBrowseState['status'],
              page: 1,
            })
          }
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </SelectField>
        <ChipGroup
          label="Sort"
          options={SORT_OPTIONS}
          value={state.sort}
          onChange={(sort) => onChange({ ...state, sort, page: 1 })}
        />
      </FilterBar>
    </Card>
  );
}
