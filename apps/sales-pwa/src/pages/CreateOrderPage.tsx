import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@groaurum/auth/react';
import type {
  OrderPreviewLine,
  SalesmanOrderDetail,
  SalesmanOrderPreview,
} from '@groaurum/api-client';
import { Button, Card, EmptyState } from '@groaurum/ui';
import { useSalesmanApi } from '@/data/SalesDataProviders';
import {
  clearOrderDraft,
  loadOrderDraft,
  saveOrderDraft,
  setDraftLine,
  type OrderDraftLine,
} from '@/data/order-draft';
import { useOrderPreview } from '@/data/order-preview';
import {
  createSubmitLock,
  evaluateOrderSubmitGate,
  submitReviewedOrder,
  type PlacedOrderOutcome,
  type SubmitFailure,
} from '@/data/order-submit';
import { ErrorState } from '@/components/ErrorState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LoadingState } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { errorMessage } from '@/lib/errors';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { CartSummaryBar, cartSummaryStatus } from './create-order/CartSummaryBar';
import { CatalogueList } from './create-order/CatalogueList';
import { OrderConfirmation } from './create-order/OrderConfirmation';
import { OrderReview } from './create-order/OrderReview';
import { ShopPicker } from './create-order/ShopPicker';

type Step = 'build' | 'review' | 'done';

function backTarget(shopId: string, step: Step): { to: string; label: string } {
  if (step === 'build' && shopId) return { to: `/customers/${shopId}`, label: 'Customer' };
  return { to: '/orders', label: 'Orders' };
}

export function CreateOrderPage() {
  const api = useSalesmanApi();
  const user = useCurrentUser();
  const profileId = user?.id ?? '';
  const queryClient = useQueryClient();
  const toast = useToast();
  const online = useOnlineStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const shopId = searchParams.get('shopId') ?? '';

  const [initialDraft] = useState(() => loadOrderDraft(profileId));
  const [lines, setLines] = useState<OrderDraftLine[]>(initialDraft?.lines ?? []);
  const [notes, setNotes] = useState(initialDraft?.notes ?? '');
  const [draftShopId, setDraftShopId] = useState(initialDraft?.shopId ?? '');
  const [step, setStep] = useState<Step>('build');
  const [reviewed, setReviewed] = useState<SalesmanOrderPreview | null>(null);
  const [pricesChanged, setPricesChanged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  const [outcome, setOutcome] = useState<PlacedOrderOutcome | null>(null);
  const [placedOrder, setPlacedOrder] = useState<SalesmanOrderDetail | null | undefined>(
    undefined,
  );
  const lockRef = useRef(createSubmitLock());

  // Restore the draft's retailer when opening New order without one.
  useEffect(() => {
    if (!shopId && initialDraft?.shopId) {
      const next = new URLSearchParams(searchParams);
      next.set('shopId', initialDraft.shopId);
      setSearchParams(next, { replace: true });
    }
    // Mount only: later shop changes are the salesman's choice.
  }, []);

  useEffect(() => {
    if (step === 'done') return;
    saveOrderDraft(profileId, { shopId, lines, notes });
  }, [profileId, shopId, lines, notes, step]);

  const retailersQuery = useQuery({
    queryKey: ['sales', 'retailers'],
    queryFn: () => api.listRetailers(),
  });

  const skusQuery = useQuery({
    queryKey: ['sales', 'orderable-skus'],
    queryFn: () => api.listOrderableSkus(),
    // Must stay short: Admin product/price edits should appear on this screen.
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const rowsBySku = useMemo(
    () => new Map((skusQuery.data ?? []).map((row) => [row.sku.id, row])),
    [skusQuery.data],
  );

  // Drop draft items that are no longer orderable once the catalogue is known.
  useEffect(() => {
    if (!skusQuery.data) return;
    const kept = lines.filter((l) => rowsBySku.has(l.skuId));
    if (kept.length !== lines.length) {
      setLines(kept);
      toast.warning('Some saved items are no longer available and were removed.');
    }
    // Re-check only when the catalogue changes, not on every cart edit.
  }, [skusQuery.data]);

  const gate = evaluateOrderSubmitGate({
    shopId,
    retailers: retailersQuery.data,
    retailersLoading: retailersQuery.isLoading,
    retailersError: retailersQuery.isError,
    catalogueReady: Boolean(skusQuery.data && skusQuery.data.length > 0),
  });
  const shop = retailersQuery.data?.find((r) => r.id === shopId) ?? null;

  const preview = useOrderPreview(api, lines, online);
  const previewBySku = useMemo(
    () =>
      new Map<string, OrderPreviewLine>(
        (preview.current?.lines ?? []).map((l) => [l.skuId, l]),
      ),
    [preview.current],
  );
  const summary = cartSummaryStatus({ itemCount: lines.length, online, preview });

  function selectShop(nextShopId: string) {
    const next = new URLSearchParams(searchParams);
    if (nextShopId) next.set('shopId', nextShopId);
    else next.delete('shopId');
    setSearchParams(next, { replace: true });
    setDraftShopId(nextShopId);
  }

  function changeLine(skuId: string, quantity: number) {
    setLines((prev) => setDraftLine(prev, skuId, quantity));
  }

  function discardDraft() {
    setLines([]);
    setNotes('');
    setDraftShopId(shopId);
    clearOrderDraft(profileId);
  }

  function goToReview() {
    if (!gate.canSubmit || !online || !preview.current?.allValid) return;
    setReviewed(preview.current);
    setPricesChanged(false);
    setFailure((f) => (f?.kind === 'uncertain' ? f : null));
    setStep('review');
    window.scrollTo(0, 0);
  }

  async function submit() {
    if (!reviewed || !gate.canSubmit || !online) return;
    if (!lockRef.current.tryAcquire()) return;
    setSubmitting(true);
    setFailure(null);
    setPricesChanged(false);
    let placed = false;
    try {
      const result = await submitReviewedOrder({
        api,
        shopId: gate.shop.id,
        serviceAreaId: gate.serviceAreaId,
        lines,
        reviewed,
        notes,
      });
      if (result.kind === 'prices_changed') {
        setReviewed(result.fresh);
        setPricesChanged(true);
        return;
      }
      if (result.kind === 'failed') {
        setFailure(result.failure);
        return;
      }

      // The order exists from here on: never release the lock or allow a resubmit.
      placed = true;
      clearOrderDraft(profileId);
      const outcome = result.outcome;
      const orderId = outcome.orderId;
      setOutcome(outcome);
      setStep('done');
      window.scrollTo(0, 0);
      if (outcome.kind === 'confirmation_sent') toast.success('Order placed');
      else toast.warning('Order saved, but the approval request was not sent');
      void queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
      void queryClient.invalidateQueries({ queryKey: ['sales', 'dashboard'] });
      try {
        setPlacedOrder(await api.getOrder(orderId));
      } catch {
        setPlacedOrder(null);
      }
    } finally {
      setSubmitting(false);
      if (!placed) lockRef.current.release();
    }
  }

  function startAnotherOrder() {
    lockRef.current = createSubmitLock();
    setLines([]);
    setNotes('');
    setReviewed(null);
    setOutcome(null);
    setPlacedOrder(undefined);
    setFailure(null);
    setStep('build');
    selectShop('');
  }

  if (step === 'done' && outcome) {
    return (
      <OrderConfirmation
        outcome={outcome}
        shopName={shop?.tradeName ?? '—'}
        reviewedTotal={reviewed?.total ?? 0}
        order={placedOrder}
        onNewOrder={startAnotherOrder}
      />
    );
  }

  const back = backTarget(shopId, step);

  if (step === 'review' && reviewed && shop) {
    return (
      <div className="ga-sales-stack">
        <ScreenHeader title="Review order" subtitle={shop.tradeName} backTo={back.to} backLabel={back.label} />
        <OrderReview
          shop={shop}
          reviewed={reviewed}
          rowsBySku={rowsBySku}
          notes={notes}
          onNotesChange={setNotes}
          submitting={submitting}
          online={online}
          failure={failure}
          pricesChanged={pricesChanged}
          onSubmit={() => {
            void submit();
          }}
          onEdit={() => {
            setStep('build');
            setPricesChanged(false);
          }}
        />
      </div>
    );
  }

  const blockedReason = !gate.canSubmit && !retailersQuery.isError ? gate.reason : null;
  const draftFromOtherShop =
    lines.length > 0 && draftShopId && shopId && draftShopId !== shopId
      ? retailersQuery.data?.find((r) => r.id === draftShopId)?.tradeName
      : null;

  return (
    <div className="ga-sales-stack ga-sales-order-build">
      <ScreenHeader
        title="New order"
        subtitle={shop ? shop.tradeName : 'Choose the customer first'}
        backTo={back.to}
        backLabel={back.label}
      />

      {retailersQuery.isError ? (
        <ErrorState
          message={`Could not load your customers: ${errorMessage(retailersQuery.error, 'unknown error')}`}
          onRetry={() => {
            void retailersQuery.refetch();
          }}
          retrying={retailersQuery.isFetching}
          retryLabel="Retry customers"
        />
      ) : null}

      {retailersQuery.isLoading ? <LoadingState label="Loading customers…" rows={3} /> : null}

      {retailersQuery.data && !shopId ? (
        <ShopPicker retailers={retailersQuery.data} onSelect={selectShop} />
      ) : null}

      {retailersQuery.data && shopId ? (
        <Card>
          <div className="ga-sales-list-item__row">
            <div>
              <p className="ga-sales-muted">Ordering for</p>
              <p className="ga-sales-list-item__title">{shop?.tradeName ?? 'Unknown customer'}</p>
              {shop ? <p className="ga-sales-list-item__meta">{shop.areaLabel}</p> : null}
            </div>
            <Button type="button" variant="secondary" onClick={() => selectShop('')}>
              Change customer
            </Button>
          </div>
        </Card>
      ) : null}

      {blockedReason && shopId ? (
        <p className="ga-sales-warning" role="status">
          {blockedReason}
        </p>
      ) : null}

      {draftFromOtherShop ? (
        <p className="ga-sales-warning" role="status">
          These items were saved in a draft for {draftFromOtherShop}. Check them before ordering
          for {shop?.tradeName ?? 'this customer'}.
        </p>
      ) : null}

      {shop ? (
        <>
          {skusQuery.isLoading ? <LoadingState label="Loading products…" rows={4} /> : null}

          {skusQuery.isError ? (
            <ErrorState
              message={`Could not load products: ${errorMessage(skusQuery.error, 'unknown error')}`}
              onRetry={() => {
                void skusQuery.refetch();
              }}
              retrying={skusQuery.isFetching}
              retryLabel="Retry products"
              stale={Boolean(skusQuery.data)}
            />
          ) : null}

          {skusQuery.data && skusQuery.data.length === 0 ? (
            <EmptyState
              title="No products to order yet"
              detail="No active products have a price set. Ask your admin to publish prices, then open this screen again."
            />
          ) : null}

          {skusQuery.data && skusQuery.data.length > 0 ? (
            <CatalogueList
              rows={skusQuery.data}
              lines={lines}
              previewBySku={previewBySku}
              disabled={submitting}
              onChange={changeLine}
              onAdjusted={(message) => toast.warning(message)}
            />
          ) : null}
        </>
      ) : null}

      {shopId ? (
        <CartSummaryBar
          itemCount={lines.length}
          status={summary}
          onRetry={preview.retry}
          retrying={preview.retrying}
          note={lines.length > 0 ? 'Draft — not submitted. Saved on this phone.' : null}
          action={
            <div className="ga-sales-summary__actions">
              {lines.length > 0 ? (
                <Button type="button" variant="ghost" onClick={discardDraft}>
                  Clear
                </Button>
              ) : null}
              <Button
                type="button"
                variant="primary"
                className="ga-sales-summary__cta"
                disabled={!gate.canSubmit || summary.kind !== 'ready'}
                onClick={goToReview}
              >
                Review order
              </Button>
            </div>
          }
        />
      ) : null}
    </div>
  );
}
