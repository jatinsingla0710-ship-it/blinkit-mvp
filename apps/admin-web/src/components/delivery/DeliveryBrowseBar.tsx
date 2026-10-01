import type { DeliveryBrowseState, DeliverySortId } from '@/data/delivery-types';
import { EMPTY_DELIVERY_BROWSE } from '@/data/browse-helpers';
import {
  Button,
  Card,
  ChipGroup,
  FilterBar,
  SelectField,
  TextField,
} from '@groaurum/ui';

type Props = {
  state: DeliveryBrowseState;
  onChange: (next: DeliveryBrowseState) => void;
};

const SORT_OPTIONS: { id: DeliverySortId; label: string }[] = [
  { id: 'route_az', label: 'Route A–Z' },
  { id: 'orders_desc', label: 'Orders' },
  { id: 'cod_desc', label: 'COD' },
  { id: 'updated_desc', label: 'Updated' },
];

export function DeliveryBrowseBar({ state, onChange }: Props) {
  return (
    <Card
      title="Search · Filter · Sort"
      action={
        <Button
          variant="secondary"
          onClick={() => onChange({ ...EMPTY_DELIVERY_BROWSE })}
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
          placeholder="Route, driver, vehicle, or area..."
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
              status: status as DeliveryBrowseState['status'],
              page: 1,
            })
          }
        >
          <option value="all">All</option>
          <option value="planned">Planned</option>
          <option value="loading">Loading</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
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
