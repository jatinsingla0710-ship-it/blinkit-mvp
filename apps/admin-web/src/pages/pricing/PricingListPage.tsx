import { usePermissions } from '@groaurum/auth/react';
import { SkuPriceListTable } from '@/components/pricing/SkuPriceListTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { usePricesListQuery } from '@/data/hooks';
import './PricingListPage.css';

/**
 * Pricing Management — SKU current trade prices.
 */
export function PricingListPage() {
  const { hasPermission } = usePermissions();
  const canManagePricing = hasPermission('pricing:manage');
  const { state } = usePricesListQuery();

  return (
    <QueryStateGate title="Pricing" state={state}>
      {(rows) => {
        const live = rows.filter((r) => r.status === 'live').length;
        const unpriced = rows.filter((r) => r.status === 'unpriced').length;

        return (
          <div className="ga-pricing-list">
            <PageHeader
              title="Pricing"
              subtitle="Wholesale SKU trade prices · append-only history"
              meta={`${live} live · ${unpriced} unpriced${canManagePricing ? '' : ' · read-only'}`}
            />

            <SkuPriceListTable rows={rows} />
          </div>
        );
      }}
    </QueryStateGate>
  );
}
