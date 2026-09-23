import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  buildAttentionCardCopy,
  buildOrdersAttentionResult,
  enrichOrderRowsWithAttention,
} from '@/data/order-attention';
import {
  EMPTY_ORDERS_FILTERS,
  filterOrderRows,
  paginateRows,
  parseOrdersListPreset,
  sortOrderRows,
  type OrdersListPreset,
} from '@/data/order-helpers';
import type { OrdersFilterState, OrdersSortId } from '@/data/orders-types';
import { OrdersAttentionPanel } from '@/components/orders/OrdersAttentionPanel';
import { OrdersSummaryCards } from '@/components/orders/OrdersSummaryCards';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useOrdersNeedingAttentionQuery, useOrdersSnapshotQuery } from '@/data/hooks';
import './OrdersListPage.css';

const PAGE_SIZE = 20;

function readInitialFilters(searchParams: URLSearchParams): {
  filters: OrdersFilterState;
  preset?: OrdersListPreset;
} {
  const preset = parseOrdersListPreset(searchParams.get('preset'));

  return {
    filters: {
      ...EMPTY_ORDERS_FILTERS,
      search: searchParams.get('q') ?? '',
      date: searchParams.get('date') ?? '',
      payment: 'all',
      status: 'all',
      salesman: 'all',
      warehouse: 'all',
    },
    preset,
  };
}

/**
 * Orders Management - wholesale operations control center.
 */
export function OrdersListPage() {
  const { state } = useOrdersSnapshotQuery();
  const { state: attentionState } = useOrdersNeedingAttentionQuery(200);
  const [searchParams] = useSearchParams();
  const initial = useMemo(
    () => readInitialFilters(searchParams),
    [searchParams],
  );
  const [filters, setFilters] = useState<OrdersFilterState>(initial.filters);
  const sort: OrdersSortId = 'placed_desc';
  const [page, setPage] = useState(1);
  const preset = useMemo(
    () => parseOrdersListPreset(searchParams.get('preset')),
    [searchParams],
  );

  useEffect(() => {
    setFilters(initial.filters);
    setPage(1);
  }, [initial.filters, preset]);

  const attentionResult = useMemo(() => {
    if (!attentionState.data || !state.data) return null;
    const orderCodeById = new Map(
      state.data.rows.map((row) => [row.id, row.orderCode]),
    );
    return buildOrdersAttentionResult({
      ...attentionState.data,
      orderCodeById,
    });
  }, [attentionState.data, state.data]);

  const attentionOrderIds = useMemo(
    () => new Set(attentionResult?.orders.map((item) => item.orderId) ?? []),
    [attentionResult],
  );

  const enrichedRows = useMemo(() => {
    if (!state.data) return [];
    return enrichOrderRowsWithAttention(
      state.data.rows,
      attentionResult?.orders ?? [],
    );
  }, [state.data, attentionResult]);

  const filtered = useMemo(() => {
    return sortOrderRows(
      filterOrderRows(enrichedRows, filters, {
        preset,
        attentionOrderIds,
      }),
      sort,
    );
  }, [enrichedRows, filters, preset, sort, attentionOrderIds]);

  const paged = useMemo(
    () => paginateRows(filtered, page, PAGE_SIZE),
    [filtered, page],
  );

  const summaryItems = useMemo(() => {
    if (!state.data) return [];
    const items = [...state.data.kpis];
    if (!attentionResult) return items;

    const cardCopy = buildAttentionCardCopy(
      attentionResult.count,
      attentionResult.summary,
    );
    const idx = items.findIndex((k) => k.id === 'needs_attention');
    if (idx >= 0) {
      items[idx] = {
        ...items[idx],
        value: cardCopy.value,
        subtitle: cardCopy.subtitle,
        bullets: cardCopy.bullets,
        hint: 'Orders requiring manual action',
        tone: attentionResult.count > 0 ? 'danger' : 'default',
      };
    }
    return items;
  }, [state.data, attentionResult]);

  const showAttentionView = preset === 'needs_attention';

  return (
    <QueryStateGate title="Orders" state={state}>
      {(snapshot) => (
        <div className="ga-orders-list">
          <PageHeader
            title="Orders"
            subtitle="Wholesale order workflow - placement to payment"
            meta={snapshot.generatedAtLabel}
          />

          <OrdersSummaryCards items={summaryItems} />

          {showAttentionView && attentionResult ? (
            <OrdersAttentionPanel items={attentionResult.orders} />
          ) : null}

          <div className="ga-orders-list__toolbar">
            <label className="ga-orders-list__search">
              <span className="ga-orders-list__search-icon" aria-hidden>
                &#8981;
              </span>
              <input
                type="search"
                placeholder="Order no, customer, mobile..."
                value={filters.search}
                onChange={(e) => {
                  setFilters({ ...filters, search: e.target.value });
                  setPage(1);
                }}
                aria-label="Search orders"
              />
            </label>
            <div className="ga-orders-list__summary">
              <span>
                Showing {paged.rows.length} of {paged.total}
                {preset ? ` - ${preset.replace(/_/g, ' ')}` : ''}
                {` - ${snapshot.rows.length} total`}
              </span>
            </div>
          </div>

          <OrdersTable
            rows={paged.rows}
            page={paged.page}
            pageCount={paged.pageCount}
            total={paged.total}
            onPageChange={setPage}
            showAttentionColumn={!showAttentionView}
          />
        </div>
      )}
    </QueryStateGate>
  );
}
