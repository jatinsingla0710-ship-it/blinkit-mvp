import { useState } from 'react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useInventorySnapshotQuery } from '@/data/hooks';
import { INVENTORY_SECTION_LINKS } from '@/data/section-links';
import './InventoryListPage.css';

/**
 * Inventory — stock levels by product and warehouse.
 */
export function InventoryListPage() {
  const { state } = useInventorySnapshotQuery();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'low' | 'out_of_stock' | 'healthy'
  >('all');

  return (
    <QueryStateGate title="Inventory" state={state}>
      {(snapshot) => {
        const q = query.trim().toLowerCase();
        const filtered = snapshot.rows.filter((row) => {
          if (statusFilter === 'low' && row.status !== 'low') return false;
          if (
            statusFilter === 'out_of_stock' &&
            row.status !== 'out_of_stock'
          ) {
            return false;
          }
          if (
            statusFilter === 'healthy' &&
            row.status !== 'healthy' &&
            row.status !== 'incoming'
          ) {
            return false;
          }
          if (!q) return true;
          return (
            row.productName.toLowerCase().includes(q) ||
            row.skuName.toLowerCase().includes(q) ||
            row.skuCode.toLowerCase().includes(q) ||
            row.categoryName.toLowerCase().includes(q) ||
            row.warehouses.some((wh) =>
              wh.warehouseName.toLowerCase().includes(q),
            )
          );
        });

        return (
          <div className="ga-inv-list">
            <PageHeader
              title="Inventory"
              subtitle="See stock on hand, low stock, and movements"
              meta={snapshot.generatedAtLabel}
            />

            <SectionRelatedLinks
              label="Inventory section"
              links={[...INVENTORY_SECTION_LINKS]}
            />

            <KpiCards items={snapshot.kpis} />

            <div className="ga-inv-list__toolbar">
              <label className="ga-inv-list__search">
                <span className="ga-sr-only">Search inventory</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search product, SKU, category, warehouse…"
                />
              </label>
              <div
                className="ga-inv-list__filters"
                role="group"
                aria-label="Status filter"
              >
                {(
                  [
                    ['all', 'All'],
                    ['healthy', 'Healthy'],
                    ['low', 'Low Stock'],
                    ['out_of_stock', 'Out of Stock'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={
                      statusFilter === id
                        ? 'ga-inv-list__chip ga-inv-list__chip--active'
                        : 'ga-inv-list__chip'
                    }
                    onClick={() => setStatusFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="ga-inv-list__count">
                Showing {filtered.length} of {snapshot.rows.length}
              </p>
            </div>

            <InventoryTable rows={filtered} />
          </div>
        );
      }}
    </QueryStateGate>
  );
}
