import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { SkuPriceListTable } from '@/components/pricing/SkuPriceListTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { usePricesListQuery } from '@/data/hooks';
import { PRODUCTS_SECTION_LINKS } from '@/data/section-links';
import './PricingListPage.css';

/**
 * Product pricing — SKU trade prices (under Products section).
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
              subtitle="Set and review product trade prices"
              meta={`${live} live · ${unpriced} unpriced${canManagePricing ? '' : ' · read-only'}`}
            />

            <SectionRelatedLinks
              label="Products section"
              links={[...PRODUCTS_SECTION_LINKS]}
            />

            <SkuPriceListTable rows={rows} />
          </div>
        );
      }}
    </QueryStateGate>
  );
}
