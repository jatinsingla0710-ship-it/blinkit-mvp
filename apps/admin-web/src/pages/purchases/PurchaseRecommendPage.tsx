import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import type { PurchaseRecommendationRow } from '@/data/purchase-recommendations';
import { usePurchaseRecommendationsSnapshotQuery } from '@/data/hooks';
import {
  ACCOUNTING_SECTION_LINKS,
  INVENTORY_SECTION_LINKS,
} from '@/data/section-links';
import '@groaurum/ui/styles/data-table.css';
import '../receivables/ReceivablesPage.css';
import './PurchaseRecommendPage.css';

type StatusFilter = 'all' | 'out_of_stock' | 'low';

function RecommendTable({ rows }: { rows: PurchaseRecommendationRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No matching suggestions"
        detail="Try another filter, or check Inventory for current stock."
      />
    );
  }

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Stock</th>
            <th>Weekly sales</th>
            <th>Buy</th>
            <th>Why</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.skuId}>
              <td>
                <Link to={row.inventoryHref}>{row.productName}</Link>
                <div className="ga-receivables__meta">
                  {row.skuCode} · {row.skuName}
                  {row.supplierName ? ` · Last: ${row.supplierName}` : ''}
                </div>
              </td>
              <td>
                <strong
                  className={
                    row.status === 'out_of_stock' || row.status === 'low'
                      ? 'ga-receivables__due'
                      : undefined
                  }
                >
                  {row.currentStockLabel}
                </strong>
                <div className="ga-receivables__meta">{row.statusLabel}</div>
              </td>
              <td>
                {row.weeklyVelocity > 0 ? row.weeklyVelocityLabel : '—'}
                {row.openDraftQty > 0 ? (
                  <div className="ga-receivables__meta">
                    Draft open: {row.openDraftLabel}
                  </div>
                ) : null}
              </td>
              <td>
                <strong>{row.recommendedQtyLabel}</strong>
              </td>
              <td>
                <div>{row.reason}</div>
                <details className="ga-purchase-recommend__explain">
                  <summary>Explain</summary>
                  <ul>
                    {row.explainLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </details>
              </td>
              <td className="ga-receivables__actions">
                <Link to={row.purchaseHref}>Start purchase</Link>
                {' · '}
                <Link to={row.inventoryHref}>Stock</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PurchaseRecommendPage() {
  const { state } = usePurchaseRecommendationsSnapshotQuery();
  const [filter, setFilter] = useState<StatusFilter>('all');

  return (
    <div className="ga-receivables ga-purchase-recommend">
      <PageHeader
        title="What to buy"
        description="Suggested purchases from current stock and recent sales. Review quantities, then start a purchase yourself — nothing is ordered automatically."
      />
      <SectionRelatedLinks
        links={[...INVENTORY_SECTION_LINKS, ...ACCOUNTING_SECTION_LINKS].filter(
          (link, index, all) =>
            all.findIndex((other) => other.to === link.to) === index,
        )}
      />

      <QueryStateGate
        state={state}
        emptyTitle="No purchase suggestions"
        emptyDetail="Stock looks covered for now, or there is no inventory yet."
      >
        {(data) => {
          const filtered =
            filter === 'all'
              ? data.rows
              : data.rows.filter((row) => row.status === filter);

          return (
            <>
              <div className="ga-purchase-recommend__summary">
                <div>
                  <div className="ga-purchase-recommend__summary-label">
                    Suggestions
                  </div>
                  <div className="ga-purchase-recommend__summary-value">
                    {data.recommendationCount}
                  </div>
                </div>
                <div>
                  <div className="ga-purchase-recommend__summary-label">
                    Out of stock
                  </div>
                  <div className="ga-purchase-recommend__summary-value">
                    {data.outOfStockCount}
                  </div>
                </div>
                <div>
                  <div className="ga-purchase-recommend__summary-label">
                    Low stock
                  </div>
                  <div className="ga-purchase-recommend__summary-value">
                    {data.lowStockCount}
                  </div>
                </div>
                <div className="ga-receivables__meta ga-purchase-recommend__as-of">
                  Last {data.lookbackDays} days · as of {data.generatedAtLabel}
                </div>
              </div>

              <p className="ga-purchase-recommend__honesty">{data.honestyNote}</p>

              <div className="ga-receivables__filters">
                {(
                  [
                    ['all', 'All'],
                    ['out_of_stock', 'Out of stock'],
                    ['low', 'Low stock'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={
                      filter === id
                        ? 'ga-receivables__chip ga-receivables__chip--active'
                        : 'ga-receivables__chip'
                    }
                    onClick={() => setFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {data.rows.length === 0 ? (
                <EmptyState
                  title="Nothing to buy right now"
                  detail="No SKUs need restocking under the current rules."
                />
              ) : (
                <RecommendTable rows={filtered} />
              )}

              <p className="ga-purchase-recommend__footer">
                <Link to="/purchases/new">New purchase</Link>
                {' · '}
                <Link to="/inventory?status=low">Low stock list</Link>
                {' · '}
                <Link to="/purchases">All purchases</Link>
              </p>
            </>
          );
        }}
      </QueryStateGate>
    </div>
  );
}
