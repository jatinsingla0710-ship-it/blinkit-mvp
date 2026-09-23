import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePermissions } from '@groaurum/auth/react';
import type { SetPriceDraft } from '@/data/pricing-types';
import {
  defaultPriceBasisForPackUnit,
  packTradePriceFromBasis,
} from '@/data/sku-pack-pricing';
import { CurrentPricePanel } from '@/components/pricing/CurrentPricePanel';
import { PriceHistoryTimeline } from '@/components/pricing/PriceHistoryTimeline';
import { PriceStatusBadge } from '@/components/pricing/PriceStatusBadge';
import {
  PricingQuickActions,
  type PricingQuickActionId,
} from '@/components/pricing/PricingQuickActions';
import { SetPriceForm } from '@/components/pricing/SetPriceForm';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { QueryStateGate } from '@/data/QueryStateGate';
import { usePriceDetailQuery } from '@/data/hooks';
import { formatMutationError } from '@/data/mutation-errors';
import { useCreatePriceMutation } from '@/data/mutations';
import './PricingDetailPage.css';

type PricingTab = 'current' | 'history';

const TABS: TabItem<PricingTab>[] = [
  { id: 'current', label: 'Current Price' },
  { id: 'history', label: 'Price History' },
];

function emptyDraft(netQuantityUnit?: string): SetPriceDraft {
  return {
    basisPrice: '',
    priceBasis: defaultPriceBasisForPackUnit(netQuantityUnit),
  };
}

/**
 * Pricing Management — Set / Update current trade price via trusted RPC.
 */
export function PricingDetailPage() {
  const { skuId } = useParams<{ skuId: string }>();
  const { hasPermission } = usePermissions();
  const canManagePricing = hasPermission('pricing:manage');
  const [tab, setTab] = useState<PricingTab>('current');
  const [draft, setDraft] = useState<SetPriceDraft>(() => emptyDraft());
  const [actionError, setActionError] = useState<string | null>(null);
  const { state } = usePriceDetailQuery(skuId);
  const createPrice = useCreatePriceMutation();

  const onAction = (id: PricingQuickActionId) => {
    if (id === 'set_price' || id === 'update_price') {
      setTab('current');
      return;
    }
    if (id === 'view_history') {
      setTab('history');
    }
  };

  return (
    <QueryStateGate
      title="SKU Pricing"
      state={state}
      emptyTitle="SKU not found"
      emptyDetail="Return to Pricing and select a SKU row."
    >
      {(detail) => {
        const formDraft: SetPriceDraft =
          draft.basisPrice.trim() === ''
            ? {
                ...draft,
                priceBasis: defaultPriceBasisForPackUnit(detail.netQuantityUnit),
              }
            : draft;

        return (
          <div className="ga-pricing-detail">
            <PageHeader
              title={detail.skuName}
              subtitle={`${detail.productName} · ${detail.skuCode} · ${detail.sellingUnitLabel}`}
              meta={
                <span className="ga-pricing-detail__meta">
                  <PriceStatusBadge status={detail.listStatus} />
                  <span>Updated {detail.updatedAtLabel}</span>
                </span>
              }
            />

            <div className="ga-pricing-detail__toolbar">
              <Link to="/pricing" className="ga-pricing-detail__back">
                ← Pricing
              </Link>
              {canManagePricing ? (
                <PricingQuickActions
                  hasCurrentPrice={Boolean(detail.current)}
                  onAction={onAction}
                />
              ) : null}
            </div>
            {actionError ? (
              <p className="ga-pricing-detail__error">{actionError}</p>
            ) : null}

            <div className="ga-pricing-detail__layout">
              <Card className="ga-pricing-detail__main">
                <Tabs items={TABS} active={tab} onChange={setTab} />
                <div className="ga-pricing-detail__panel">
                  {tab === 'current' ? (
                    <CurrentPricePanel
                      current={detail.current}
                      sellingUnitLabel={detail.sellingUnitLabel}
                      netQuantity={detail.netQuantity}
                      netQuantityUnit={detail.netQuantityUnit}
                    />
                  ) : null}
                  {tab === 'history' ? (
                    <PriceHistoryTimeline rows={detail.history} />
                  ) : null}
                </div>
              </Card>

              {canManagePricing ? (
                <SetPriceForm
                  draft={formDraft}
                  onChange={setDraft}
                  disabled={createPrice.isPending}
                  mode={detail.current ? 'update' : 'set'}
                  sellingUnitLabel={detail.sellingUnitLabel}
                  netQuantity={detail.netQuantity}
                  netQuantityUnit={detail.netQuantityUnit}
                  onSubmit={(next) => {
                    if (!skuId) return;
                    setActionError(null);
                    const basisPrice = Number(next.basisPrice);
                    if (!Number.isFinite(basisPrice) || basisPrice <= 0) {
                      setActionError('Enter a price greater than zero');
                      return;
                    }
                    const packQuantity = Number(detail.netQuantity);
                    if (!Number.isFinite(packQuantity) || packQuantity <= 0) {
                      setActionError(
                        'This SKU needs a pack size before a basis price can be converted',
                      );
                      return;
                    }
                    const converted = packTradePriceFromBasis({
                      basisPrice,
                      priceBasis: next.priceBasis,
                      packQuantity,
                      packUnit: detail.netQuantityUnit,
                    });
                    if ('error' in converted) {
                      setActionError(converted.error);
                      return;
                    }
                    createPrice.mutate(
                      {
                        skuId,
                        tradePrice: converted.packTradePrice,
                        currency: 'INR',
                      },
                      {
                        onSuccess: () =>
                          setDraft(emptyDraft(detail.netQuantityUnit)),
                        onError: (err) =>
                          setActionError(
                            formatMutationError(err, 'Price update failed'),
                          ),
                      },
                    );
                  }}
                />
              ) : (
                <p className="ga-pricing-detail__readonly">
                  Read-only role — price changes require pricing:manage.
                </p>
              )}
            </div>
          </div>
        );
      }}
    </QueryStateGate>
  );
}
