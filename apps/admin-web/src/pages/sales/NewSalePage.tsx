import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  useCustomersSnapshotQuery,
  usePricesListQuery,
} from '@/data/hooks';
import { useCompleteCounterSaleMutation } from '@/data/mutations';
import { formatInr, formatInrPrecise } from '@/data/live/format';
import {
  amountDuePreview,
  buildCounterSaleRpcArgs,
  customerDisplayName,
  formatCounterSaleError,
  lineTotal,
  newClientRequestId,
  nextQuantity,
  previewCounterSaleTotals,
  validateCounterSaleDraft,
  type CounterCartCustomLine,
  type CounterCartLine,
  type CounterPaymentMethod,
  type CounterSaleCustomer,
  type CounterSaleResult,
} from '@/data/counter-sale';
import type { SkuPriceListRow } from '@/data/pricing-types';
import './NewSalePage.css';

type CustomDraft = {
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  lineDiscount: string;
};

const EMPTY_CUSTOM: CustomDraft = {
  name: '',
  unit: 'Kg',
  quantity: '1',
  unitPrice: '',
  lineDiscount: '0',
};

function lineKey(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Admin New Sale — Vyapar-style counter billing.
 * Completes via admin_complete_counter_sale only.
 */
export function NewSalePage() {
  const navigate = useNavigate();
  const { state: customersState } = useCustomersSnapshotQuery();
  const { state: pricesState } = usePricesListQuery();
  const completeSale = useCompleteCounterSaleMutation();

  const [customer, setCustomer] = useState<CounterSaleCustomer | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickMobile, setQuickMobile] = useState('');

  const [productQuery, setProductQuery] = useState('');
  const [lines, setLines] = useState<CounterCartLine[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [customDraft, setCustomDraft] = useState<CustomDraft>(EMPTY_CUSTOM);
  const [editingPriceKey, setEditingPriceKey] = useState<string | null>(null);

  const [billDiscountInput, setBillDiscountInput] = useState('0');
  const [paymentMethod, setPaymentMethod] =
    useState<CounterPaymentMethod>('CASH');
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    result: CounterSaleResult;
    customerName: string;
  } | null>(null);

  const requestIdRef = useRef(newClientRequestId());
  const submittingRef = useRef(false);

  const billDiscount = Number(billDiscountInput) || 0;
  const totals = useMemo(
    () => previewCounterSaleTotals({ lines, billDiscount }),
    [lines, billDiscount],
  );

  const amountPaid =
    paymentMethod === 'CREDIT'
      ? 0
      : amountPaidInput === ''
        ? totals.total
        : Number(amountPaidInput) || 0;
  const amountDue = amountDuePreview(totals.total, amountPaid);

  const customers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const rows = (customersState.data?.rows ?? []).filter(
      (row) => row.status === 'active',
    );
    if (!q) return rows.slice(0, 8);
    return rows
      .filter(
        (row) =>
          row.shopName.toLowerCase().includes(q) ||
          row.ownerName.toLowerCase().includes(q) ||
          row.phoneLabel.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [customersState.data, customerQuery]);

  const products = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const rows = (pricesState.data ?? []).filter(
      (row) => row.status === 'live' && row.currentTradePrice != null,
    );
    if (!q) return rows.slice(0, 10);
    return rows
      .filter(
        (row) =>
          row.productName.toLowerCase().includes(q) ||
          row.skuName.toLowerCase().includes(q) ||
          row.skuCode.toLowerCase().includes(q),
      )
      .slice(0, 16);
  }, [pricesState.data, productQuery]);

  const addCatalogue = (sku: SkuPriceListRow) => {
    if (sku.currentTradePrice == null) return;
    setError(null);
    setLines((prev) => {
      const existing = prev.find(
        (l) => l.kind === 'CATALOGUE' && l.skuId === sku.skuId,
      );
      if (existing && existing.kind === 'CATALOGUE') {
        return prev.map((l) =>
          l.key === existing.key
            ? {
                ...existing,
                quantity: nextQuantity(
                  existing.quantity,
                  existing.quantityStep,
                  1,
                  existing.moq,
                ),
              }
            : l,
        );
      }
      const step = sku.quantityStep && sku.quantityStep > 0 ? sku.quantityStep : 1;
      const moq = sku.moq && sku.moq > 0 ? sku.moq : step;
      return [
        ...prev,
        {
          key: lineKey(),
          kind: 'CATALOGUE' as const,
          skuId: sku.skuId,
          name: sku.productName || sku.skuName,
          sellingUnitLabel: sku.sellingUnitLabel || 'unit',
          quantity: moq,
          quantityStep: step,
          moq,
          listUnitPrice: sku.currentTradePrice!,
          unitPrice: sku.currentTradePrice!,
          priceOverridden: false,
          lineDiscount: 0,
          availableQuantity: sku.availableQuantity,
        },
      ];
    });
    setProductQuery('');
  };

  const addCustomItem = () => {
    const name = customDraft.name.trim();
    const unit = customDraft.unit.trim();
    const quantity = Number(customDraft.quantity);
    const unitPrice = Number(customDraft.unitPrice);
    const lineDiscount = Number(customDraft.lineDiscount) || 0;
    if (!name) {
      setError('Enter a name for the custom item.');
      return;
    }
    if (!unit) {
      setError('Enter a unit for the custom item.');
      return;
    }
    if (!(quantity > 0) || !(unitPrice >= 0)) {
      setError('Enter a valid quantity and unit price for the custom item.');
      return;
    }
    const line: CounterCartCustomLine = {
      key: lineKey(),
      kind: 'CUSTOM',
      name,
      unit,
      quantity,
      unitPrice,
      lineDiscount: Math.max(0, lineDiscount),
    };
    if (lineTotal(line) < 0) {
      setError('Custom item discount cannot exceed the line amount.');
      return;
    }
    setLines((prev) => [...prev, line]);
    setCustomDraft(EMPTY_CUSTOM);
    setShowCustom(false);
    setError(null);
  };

  const updateLineQty = (key: string, quantity: number) => {
    setLines((prev) =>
      prev
        .map((l) => {
          if (l.key !== key) return l;
          if (l.kind === 'CATALOGUE') {
            if (quantity <= 0) return null;
            return { ...l, quantity };
          }
          if (quantity <= 0) return null;
          return { ...l, quantity };
        })
        .filter(Boolean) as CounterCartLine[],
    );
  };

  const selectWalkIn = () => {
    setCustomer({ kind: 'walkIn' });
    setCustomerQuery('');
    setShowQuickCreate(false);
    setError(null);
  };

  const confirmQuickCreate = () => {
    const tradeName = quickName.trim();
    const mobile = quickMobile.trim();
    if (!tradeName || !mobile) {
      setError('Enter customer name and mobile.');
      return;
    }
    setCustomer({
      kind: 'quickCreate',
      tradeName,
      mobile,
      serviceAreaId: customersState.data?.createDefaults?.serviceAreaId,
    });
    setShowQuickCreate(false);
    setQuickName('');
    setQuickMobile('');
    setCustomerQuery('');
    setError(null);
  };

  const onPaymentMethod = (method: CounterPaymentMethod) => {
    setPaymentMethod(method);
    setError(null);
    if (method === 'CREDIT') {
      setAmountPaidInput('0');
    } else if (amountPaidInput === '0' || amountPaidInput === '') {
      setAmountPaidInput(String(totals.total));
    }
  };

  const onComplete = () => {
    if (submittingRef.current || completeSale.isPending) return;
    const validation = validateCounterSaleDraft({
      customer,
      lines,
      billDiscount,
      paymentMethod,
      amountPaid,
    });
    if (validation || !customer) {
      setError(validation ?? 'Select a customer.');
      return;
    }
    setError(null);
    submittingRef.current = true;
    const args = buildCounterSaleRpcArgs({
      customer,
      lines,
      billDiscount,
      paymentMethod,
      amountPaid,
      clientRequestId: requestIdRef.current,
    });
    const customerName = customerDisplayName(customer);
    completeSale.mutate(
      {
        shop: args.p_shop,
        lines: args.p_lines,
        payment: args.p_payment,
        billDiscount: args.p_bill_discount,
        notes: args.p_notes,
        clientRequestId: args.p_client_request_id,
      },
      {
        onSuccess: (result) => {
          setSuccess({ result, customerName });
          submittingRef.current = false;
        },
        onError: (err) => {
          setError(formatCounterSaleError(err));
          submittingRef.current = false;
          // Keep same idempotency key so a true double-submit still replays.
        },
      },
    );
  };

  const startAnother = () => {
    requestIdRef.current = newClientRequestId();
    setSuccess(null);
    setCustomer(null);
    setLines([]);
    setBillDiscountInput('0');
    setPaymentMethod('CASH');
    setAmountPaidInput('');
    setError(null);
    setProductQuery('');
    setCustomerQuery('');
  };

  if (success) {
    const { result, customerName } = success;
    return (
      <div className="ga-new-sale">
        <PageHeader
          title="Sale completed"
          meta={
            <Link to="/sales" className="ga-new-sale__back">
              ← Invoices
            </Link>
          }
        />
        <div className="ga-new-sale__success" role="status">
          <dl className="ga-new-sale__success-dl">
            <div>
              <dt>Invoice</dt>
              <dd>{result.invoiceNumber || '—'}</dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{customerName}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatInrPrecise(result.total)}</dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{formatInrPrecise(result.amountPaid)}</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>{formatInrPrecise(result.amountDue)}</dd>
            </div>
          </dl>
          <div className="ga-new-sale__success-actions">
            <Button
              variant="primary"
              onClick={() =>
                navigate(`/sales/${result.saleId}?preview=1`)
              }
            >
              Print Bill
            </Button>
            <Button variant="secondary" onClick={startAnother}>
              New Sale
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate(`/sales/${result.saleId}`)}
            >
              View Sale
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const pending = completeSale.isPending;

  return (
    <div className="ga-new-sale">
      <PageHeader
        title="New Sale"
        subtitle="Counter billing — customer, items, payment"
        meta={
          <Link to="/sales" className="ga-new-sale__back">
            ← Back
          </Link>
        }
      />

      <div className="ga-new-sale__layout">
        <div className="ga-new-sale__main">
          <section className="ga-new-sale__section" aria-label="Customer">
            <div className="ga-new-sale__section-head">
              <h2>Customer</h2>
              <div className="ga-new-sale__section-actions">
                <button
                  type="button"
                  className="ga-new-sale__chip"
                  onClick={selectWalkIn}
                >
                  Walk-in Customer
                </button>
                <button
                  type="button"
                  className="ga-new-sale__chip ga-new-sale__chip--primary"
                  onClick={() => {
                    setShowQuickCreate((v) => !v);
                    setError(null);
                  }}
                >
                  + Add Customer
                </button>
              </div>
            </div>

            {customer ? (
              <div className="ga-new-sale__selected">
                <div>
                  <strong>{customerDisplayName(customer)}</strong>
                  {customer.kind === 'existing' && customer.phoneLabel ? (
                    <span className="ga-new-sale__muted">
                      {' '}
                      · {customer.phoneLabel}
                    </span>
                  ) : null}
                  {customer.kind === 'quickCreate' ? (
                    <span className="ga-new-sale__muted">
                      {' '}
                      · {customer.mobile} · new
                    </span>
                  ) : null}
                  {customer.kind === 'walkIn' ? (
                    <span className="ga-new-sale__muted">
                      {' '}
                      · counter walk-in
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="ga-new-sale__link-btn"
                  onClick={() => setCustomer(null)}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <label className="ga-new-sale__search">
                  <span className="ga-new-sale__sr">Search customer</span>
                  <input
                    type="search"
                    placeholder="Search name or mobile…"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                {showQuickCreate ? (
                  <div className="ga-new-sale__quick">
                    <label>
                      Customer name
                      <input
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        placeholder="Shop or person name"
                      />
                    </label>
                    <label>
                      Mobile
                      <input
                        value={quickMobile}
                        onChange={(e) => setQuickMobile(e.target.value)}
                        placeholder="10-digit mobile"
                        inputMode="tel"
                      />
                    </label>
                    <div className="ga-new-sale__quick-actions">
                      <Button variant="primary" onClick={confirmQuickCreate}>
                        Use this customer
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setShowQuickCreate(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
                <ul className="ga-new-sale__results">
                  {customers.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="ga-new-sale__result"
                        onClick={() => {
                          setCustomer({
                            kind: 'existing',
                            shopId: row.id,
                            displayName: row.shopName,
                            phoneLabel: row.phoneLabel,
                          });
                          setCustomerQuery('');
                          setError(null);
                        }}
                      >
                        <span className="ga-new-sale__result-title">
                          {row.shopName}
                        </span>
                        <span className="ga-new-sale__result-meta">
                          {row.phoneLabel}
                          {row.areaLabel ? ` · ${row.areaLabel}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                  {customers.length === 0 && customerQuery.trim() ? (
                    <li className="ga-new-sale__empty-hint">
                      No match. Use + Add Customer or Walk-in.
                    </li>
                  ) : null}
                </ul>
              </>
            )}
          </section>

          <section className="ga-new-sale__section" aria-label="Items">
            <div className="ga-new-sale__section-head">
              <h2>Items</h2>
              <button
                type="button"
                className="ga-new-sale__chip ga-new-sale__chip--primary"
                onClick={() => {
                  setShowCustom((v) => !v);
                  setError(null);
                }}
              >
                + Add Custom Item
              </button>
            </div>

            <label className="ga-new-sale__search">
              <span className="ga-new-sale__sr">Search products</span>
              <input
                type="search"
                placeholder="Search products…"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                autoComplete="off"
              />
            </label>

            {productQuery.trim() || products.length > 0 ? (
              <ul className="ga-new-sale__results">
                {products.map((sku) => (
                  <li key={sku.skuId}>
                    <button
                      type="button"
                      className="ga-new-sale__result"
                      onClick={() => addCatalogue(sku)}
                    >
                      <span className="ga-new-sale__result-title">
                        {sku.productName || sku.skuName}
                      </span>
                      <span className="ga-new-sale__result-meta">
                        {sku.sellingUnitLabel || 'unit'}
                        {' · '}
                        {sku.currentPriceLabel}
                        {sku.availableQuantity != null
                          ? ` · Stock ${sku.availableQuantity}`
                          : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {showCustom ? (
              <div className="ga-new-sale__quick">
                <label>
                  Item name
                  <input
                    value={customDraft.name}
                    onChange={(e) =>
                      setCustomDraft((d) => ({ ...d, name: e.target.value }))
                    }
                    placeholder="Special Grocery Item"
                  />
                </label>
                <div className="ga-new-sale__quick-grid">
                  <label>
                    Unit
                    <input
                      value={customDraft.unit}
                      onChange={(e) =>
                        setCustomDraft((d) => ({ ...d, unit: e.target.value }))
                      }
                      placeholder="Kg"
                    />
                  </label>
                  <label>
                    Quantity
                    <input
                      value={customDraft.quantity}
                      onChange={(e) =>
                        setCustomDraft((d) => ({
                          ...d,
                          quantity: e.target.value,
                        }))
                      }
                      inputMode="decimal"
                    />
                  </label>
                  <label>
                    Unit price
                    <input
                      value={customDraft.unitPrice}
                      onChange={(e) =>
                        setCustomDraft((d) => ({
                          ...d,
                          unitPrice: e.target.value,
                        }))
                      }
                      inputMode="decimal"
                      placeholder="180"
                    />
                  </label>
                  <label>
                    Line discount
                    <input
                      value={customDraft.lineDiscount}
                      onChange={(e) =>
                        setCustomDraft((d) => ({
                          ...d,
                          lineDiscount: e.target.value,
                        }))
                      }
                      inputMode="decimal"
                    />
                  </label>
                </div>
                <div className="ga-new-sale__quick-actions">
                  <Button variant="primary" onClick={addCustomItem}>
                    Add to sale
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowCustom(false);
                      setCustomDraft(EMPTY_CUSTOM);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {lines.length === 0 ? (
              <p className="ga-new-sale__empty-hint">
                Search and add products, or add a custom item.
              </p>
            ) : (
              <ul className="ga-new-sale__cart">
                {lines.map((line) => (
                  <li key={line.key} className="ga-new-sale__cart-line">
                    <div className="ga-new-sale__cart-top">
                      <div>
                        <strong>{line.name}</strong>
                        <span className="ga-new-sale__muted">
                          {' '}
                          ·{' '}
                          {line.kind === 'CATALOGUE'
                            ? line.sellingUnitLabel
                            : line.unit}
                          {line.kind === 'CUSTOM' ? ' · custom' : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="ga-new-sale__link-btn"
                        onClick={() =>
                          setLines((prev) =>
                            prev.filter((l) => l.key !== line.key),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <div className="ga-new-sale__cart-controls">
                      <div className="ga-new-sale__qty" aria-label="Quantity">
                        <button
                          type="button"
                          onClick={() => {
                            if (line.kind === 'CATALOGUE') {
                              const next = nextQuantity(
                                line.quantity,
                                line.quantityStep,
                                -1,
                                line.moq,
                              );
                              updateLineQty(line.key, next);
                            } else {
                              updateLineQty(line.key, line.quantity - 1);
                            }
                          }}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <input
                          value={String(line.quantity)}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n)) updateLineQty(line.key, n);
                          }}
                          inputMode="decimal"
                          aria-label={`Quantity for ${line.name}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (line.kind === 'CATALOGUE') {
                              updateLineQty(
                                line.key,
                                nextQuantity(
                                  line.quantity,
                                  line.quantityStep,
                                  1,
                                  line.moq,
                                ),
                              );
                            } else {
                              updateLineQty(line.key, line.quantity + 1);
                            }
                          }}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <div className="ga-new-sale__price">
                        {line.kind === 'CATALOGUE' &&
                        editingPriceKey === line.key ? (
                          <input
                            className="ga-new-sale__price-input"
                            defaultValue={String(line.unitPrice)}
                            autoFocus
                            inputMode="decimal"
                            aria-label={`Unit price for ${line.name}`}
                            onBlur={(e) => {
                              const n = Number(e.target.value);
                              if (Number.isFinite(n) && n >= 0) {
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key && l.kind === 'CATALOGUE'
                                      ? {
                                          ...l,
                                          unitPrice: n,
                                          priceOverridden: n !== l.listUnitPrice,
                                        }
                                      : l,
                                  ),
                                );
                              }
                              setEditingPriceKey(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        ) : (
                          <>
                            <span>
                              {formatInrPrecise(line.unitPrice)}
                              <span className="ga-new-sale__muted">
                                /
                                {line.kind === 'CATALOGUE'
                                  ? line.sellingUnitLabel
                                  : line.unit}
                              </span>
                            </span>
                            {line.kind === 'CATALOGUE' ? (
                              <button
                                type="button"
                                className="ga-new-sale__link-btn"
                                onClick={() => setEditingPriceKey(line.key)}
                              >
                                Edit
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                      <div className="ga-new-sale__line-total">
                        {formatInrPrecise(lineTotal(line))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="ga-new-sale__side" aria-label="Summary and payment">
          <section className="ga-new-sale__panel">
            <h2>Summary</h2>
            <dl className="ga-new-sale__totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatInrPrecise(totals.subtotal)}</dd>
              </div>
              <div className="ga-new-sale__discount-row">
                <dt>Discount</dt>
                <dd>
                  <input
                    value={billDiscountInput}
                    onChange={(e) => setBillDiscountInput(e.target.value)}
                    inputMode="decimal"
                    aria-label="Bill discount"
                  />
                </dd>
              </div>
              <div className="ga-new-sale__total-row">
                <dt>Total</dt>
                <dd>{formatInrPrecise(totals.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="ga-new-sale__panel">
            <h2>Payment</h2>
            <div
              className="ga-new-sale__methods"
              role="radiogroup"
              aria-label="Payment method"
            >
              {(['CASH', 'UPI', 'BANK', 'CREDIT'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === method}
                  className={
                    paymentMethod === method
                      ? 'ga-new-sale__method ga-new-sale__method--active'
                      : 'ga-new-sale__method'
                  }
                  onClick={() => onPaymentMethod(method)}
                >
                  {method === 'CREDIT'
                    ? 'Credit'
                    : method.charAt(0) + method.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <label className="ga-new-sale__paid-field">
              Amount Paid
              <input
                value={
                  paymentMethod === 'CREDIT' ? '0' : amountPaidInput
                }
                onChange={(e) => setAmountPaidInput(e.target.value)}
                inputMode="decimal"
                disabled={paymentMethod === 'CREDIT' || pending}
                placeholder={String(totals.total)}
              />
            </label>

            <div className="ga-new-sale__due">
              <span>Amount Due</span>
              <strong>{formatInr(amountDue)}</strong>
            </div>
          </section>

          {error ? (
            <p className="ga-new-sale__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="ga-new-sale__complete-wrap">
            <div className="ga-new-sale__complete">
              <Button
                variant="primary"
                onClick={onComplete}
                disabled={pending || lines.length === 0 || !customer}
              >
                {pending ? 'Completing…' : 'Complete Sale'}
              </Button>
            </div>
            <p className="ga-new-sale__complete-hint">
              Total {formatInrPrecise(totals.total)}
              {amountDue > 0 ? ` · Due ${formatInrPrecise(amountDue)}` : ' · Paid'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
