import { useMemo, useState } from 'react';
import type { SalesmanRetailer } from '@groaurum/api-client';
import { Badge, TextField } from '@groaurum/ui';
import { EmptyStateCard } from '@/components/EmptyStateCard';
import { ButtonLink } from '@/components/ButtonLink';
import { ChevronRightIcon } from '@/components/icons';
import { filterRetailers } from '@/data/customer-search';

export { filterRetailers };

export function ShopPicker({
  retailers,
  onSelect,
}: {
  retailers: readonly SalesmanRetailer[];
  onSelect: (shopId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const visible = useMemo(() => filterRetailers(retailers, search), [retailers, search]);

  if (retailers.length === 0) {
    return (
      <EmptyStateCard
        title="No customers assigned to you"
        detail="Add a customer first, or ask your admin to assign customers to you."
        action={
          <ButtonLink to="/customers/new" variant="primary" block>
            Add customer
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="ga-sales-stack">
      <TextField
        label="Search your customers"
        name="shop-search"
        type="search"
        placeholder="Shop name, area, PIN or mobile"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
        grow
      />
      {visible.length === 0 ? (
        <p className="ga-sales-muted" role="status">
          No customer matches “{search.trim()}”.
        </p>
      ) : (
        <div className="ga-sales-list" role="list" aria-label="Your customers">
          {visible.map((shop) => (
            <div role="listitem" key={shop.id}>
              <button
                type="button"
                className="ga-sales-list-item ga-sales-pick"
                onClick={() => onSelect(shop.id)}
              >
                <div className="ga-sales-list-item__row">
                  <div>
                    <p className="ga-sales-list-item__title">{shop.tradeName}</p>
                    <p className="ga-sales-list-item__meta">
                      {shop.areaLabel} · {shop.pinCode}
                    </p>
                  </div>
                  <ChevronRightIcon size={20} />
                </div>
                {!shop.serviceAreaId ? <Badge tone="danger">No service area</Badge> : null}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
