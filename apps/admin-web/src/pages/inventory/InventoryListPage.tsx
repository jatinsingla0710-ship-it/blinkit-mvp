import { Link, useSearchParams } from 'react-router-dom';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useInventorySnapshotQuery } from '@/data/hooks';
import {
  filterInventoryListRows,
  listWarehousesFromInventory,
  parseInventoryStatusParam,
  type InventoryListStatusFilter,
} from '@/data/inventory-ops';
import { INVENTORY_SECTION_LINKS } from '@/data/section-links';
import './InventoryListPage.css';

/**
 * Inventory — stock levels by product and warehouse.
 */
export function InventoryListPage() {
  const { state } = useInventorySnapshotQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const statusFilter = parseInventoryStatusParam(searchParams.get('status'));
  const warehouseId = searchParams.get('warehouse') ?? '';

  const setFilter = (patch: {
    q?: string;
    status?: InventoryListStatusFilter;
    warehouse?: string;
  }) => {
    const next = new URLSearchParams(searchParams);
    if (patch.q !== undefined) {
      if (patch.q.trim()) next.set('q', patch.q);
      else next.delete('q');
    }
    if (patch.status !== undefined) {
      if (patch.status === 'all') next.delete('status');
      else next.set('status', patch.status);
    }
    if (patch.warehouse !== undefined) {
      if (patch.warehouse) next.set('warehouse', patch.warehouse);
      else next.delete('warehouse');
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <QueryStateGate title="Inventory" state={state}>
      {(snapshot) => {
        const warehouses = listWarehousesFromInventory(snapshot.rows);
        const filtered = filterInventoryListRows(snapshot.rows, {
          search: query,
          status: statusFilter,
          warehouseId,
        });

        return (
          <div className="ga-inv-list">
            <PageHeader
              title="Inventory"
              subtitle="Stock quantity and value at weighted average cost"
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
                  onChange={(e) => setFilter({ q: e.target.value })}
                  placeholder="Search product, SKU, category, warehouse…"
                />
              </label>
              <label className="ga-inv-list__warehouse">
                <span className="ga-sr-only">Warehouse</span>
                <select
                  value={warehouseId}
                  onChange={(e) => setFilter({ warehouse: e.target.value })}
                  aria-label="Filter by warehouse"
                >
                  <option value="">All warehouses</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
              </label>
              <div
                className="ga-inv-list__filters"
                role="group"
                aria-label="Status filter"
              >
                {(
                  [
                    ['all', 'All'],
                    ['healthy', 'In stock'],
                    ['low', 'Low stock'],
                    ['out_of_stock', 'Out of stock'],
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
                    onClick={() => setFilter({ status: id })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="ga-inv-list__reset"
                onClick={() => {
                  setSearchParams({}, { replace: true });
                }}
              >
                Reset filters
              </button>
              <Link
                to="/reports/stock"
                className="ga-inv-list__report-link"
              >
                Stock valuation →
              </Link>
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
