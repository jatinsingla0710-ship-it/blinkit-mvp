import { useEffect, useState } from 'react';
import { Button } from '@groaurum/ui';
import type { CustomerListStatusFilter } from '@/data/customer-list-filters';
import '@/components/ui/ListToolbar.css';

type Props = {
  search: string;
  status: CustomerListStatusFilter;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: CustomerListStatusFilter) => void;
  onAdd?: () => void;
  addLabel?: string;
};

export function CustomersListToolbar({
  search,
  status,
  onSearchChange,
  onStatusChange,
  onAdd,
  addLabel = 'Add Customer',
}: Props) {
  const [draft, setDraft] = useState(search);

  useEffect(() => {
    setDraft(search);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft !== search) onSearchChange(draft);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draft, search, onSearchChange]);

  return (
    <div className="ga-list-toolbar">
      <div className="ga-list-toolbar__search-wrap">
        <input
          type="search"
          className="ga-list-toolbar__search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search customers…"
          aria-label="Search customers"
        />
        {draft ? (
          <button
            type="button"
            className="ga-list-toolbar__clear"
            onClick={() => {
              setDraft('');
              onSearchChange('');
            }}
            aria-label="Clear search"
          >
            Clear
          </button>
        ) : null}
      </div>
      <select
        className="ga-list-toolbar__select"
        value={status}
        onChange={(e) =>
          onStatusChange(e.target.value as CustomerListStatusFilter)
        }
        aria-label="Business status filter"
      >
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      {onAdd ? (
        <Button variant="primary" onClick={onAdd}>
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}
