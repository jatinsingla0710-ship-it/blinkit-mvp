import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProductSkuRow, ProductTypeVm } from '@/data/product-types';
import { formatMutationError } from '@/data/mutation-errors';
import { autoSkuDisplayName } from '@/data/product-create-helpers';
import { formStateFromSkuRow, type MoqUnitValue } from '@/data/product-form-state';
import {
  OUTER_PACKAGE_OPTIONS,
  OUTER_PACKAGES,
  deriveSellingUnitForOrder,
  formatPackLabel,
  isPriceBasisCompatible,
  minimumOrderSummary,
  moqToBasePacks,
  moqUnitOptions,
  outerPackagingSummary,
  packUnitsByCategory,
  type OuterPackageKey,
  type PackUnitKey,
  type PriceBasis,
} from '@/data/pack-units';
import {
  boxValueFromPacks,
  defaultPriceBasisForPackUnit,
  packTradePriceFromBasis,
  packsPerOuterFromCount,
  priceBasisLabel,
  priceBasesForPackUnit,
} from '@/data/sku-pack-pricing';
import { InventoryStatusBadge } from '@/components/products/ProductStatusBadges';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal, SelectField, TextField } from '@groaurum/ui';
import {
  useCreatePriceMutation,
  useCreateSkuMutation,
  useSoftDeleteSkuMutation,
  useUpdateSkuMutation,
} from '@/data/mutations';
import '@groaurum/ui/styles/data-table.css';
import './ProductSkusTab.css';

type Props = {
  productId: string;
  productName: string;
  productType: ProductTypeVm;
  skus: ProductSkuRow[];
  onSkuCreatedWithoutPrice?: (skuId: string) => void;
  canManage?: boolean;
};

type SkuFormState = {
  skuCode: string;
  name: string;
  packQuantity: string;
  packUnit: PackUnitKey;
  priceBasis: PriceBasis;
  basisPrice: string;
  outerPackQty: string;
  outerType: OuterPackageKey;
  moq: string;
  moqUnit: MoqUnitValue;
  orderStep: string;
  isActive: boolean;
  nameManual: boolean;
  hsnCode: string;
  gstRatePercent: string;
};

function emptyForm(): SkuFormState {
  return {
    skuCode: '',
    name: '',
    packQuantity: '250',
    packUnit: 'g',
    priceBasis: 'per_kg',
    basisPrice: '',
    outerPackQty: '',
    outerType: 'box',
    moq: '1',
    moqUnit: 'packs',
    orderStep: '1',
    isActive: true,
    nameManual: false,
    hsnCode: '',
    gstRatePercent: '',
  };
}

function skuFormFromRow(sku: ProductSkuRow): SkuFormState {
  const shared = formStateFromSkuRow(sku);
  return {
    ...shared,
    name: sku.name,
    isActive: sku.isActive,
    nameManual: true,
    hsnCode: sku.hsnCode ?? '',
    gstRatePercent:
      sku.gstRatePercent != null ? String(sku.gstRatePercent) : '',
  };
}

function resetMoqUnitIfNeeded(
  next: SkuFormState,
  packsPerOuter: number | null,
): SkuFormState {
  const options = moqUnitOptions({
    packUnit: next.packUnit,
    packsPerOuter,
    outerType: next.outerType,
  });
  if (options.some((o) => o.value === next.moqUnit)) return next;
  return { ...next, moqUnit: 'packs' };
}

/**
 * Product SKUs — flexible selling pack / outer packaging / MOQ (same model as Create Product).
 */
export function ProductSkusTab({
  productId,
  productName,
  productType: _productType,
  skus,
  onSkuCreatedWithoutPrice,
  canManage = false,
}: Props) {
  const createSku = useCreateSkuMutation();
  const updateSku = useUpdateSkuMutation();
  const softDeleteSku = useSoftDeleteSkuMutation();
  const createPrice = useCreatePriceMutation();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductSkuRow | null>(null);
  const [form, setForm] = useState<SkuFormState>(() => emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const unitGroups = useMemo(() => packUnitsByCategory(), []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm(),
      name: autoSkuDisplayName(productName, 250, 'g'),
    });
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (sku: ProductSkuRow) => {
    setEditing(sku);
    setForm(skuFormFromRow(sku));
    setError(null);
    setFormOpen(true);
  };

  const pending =
    createSku.isPending || updateSku.isPending || createPrice.isPending;

  const packQty = Number(form.packQuantity);
  const basisOptions = priceBasesForPackUnit(form.packUnit);

  const live = useMemo(() => {
    const basisPrice = Number(form.basisPrice);
    const outerQty = Number(form.outerPackQty);
    let packTradePrice: number | null = null;
    let packError: string | null = null;

    if (
      Number.isFinite(basisPrice) &&
      basisPrice > 0 &&
      Number.isFinite(packQty) &&
      packQty > 0
    ) {
      const converted = packTradePriceFromBasis({
        basisPrice,
        priceBasis: form.priceBasis,
        packQuantity: packQty,
        packUnit: form.packUnit,
      });
      if ('error' in converted) packError = converted.error;
      else packTradePrice = converted.packTradePrice;
    }

    let packsPerOuter: number | null = null;
    let boxError: string | null = null;
    let boxValue: number | null = null;
    let outerSummary: { packsLine: string; contentsLine: string | null } | null =
      null;

    if (form.outerPackQty.trim() !== '') {
      const packs = packsPerOuterFromCount(outerQty);
      if ('error' in packs) boxError = packs.error;
      else {
        packsPerOuter = packs.packsPerBox;
        outerSummary = outerPackagingSummary({
          packQuantity: packQty,
          packUnit: form.packUnit,
          packsPerOuter,
          outerType: form.outerType,
        });
        if (packTradePrice != null) {
          const value = boxValueFromPacks({
            packTradePrice,
            packsPerBox: packsPerOuter,
          });
          if (!('error' in value)) boxValue = value.boxValue;
        }
      }
    }

    return {
      packTradePrice,
      packError,
      packsPerOuter,
      boxError,
      boxValue,
      outerSummary,
    };
  }, [form, packQty]);

  const moqOptions = useMemo(
    () =>
      moqUnitOptions({
        packUnit: form.packUnit,
        packsPerOuter: live.packsPerOuter,
        outerType: form.outerType,
      }),
    [form.packUnit, form.outerType, live.packsPerOuter],
  );

  const moqConverted = useMemo(() => {
    const qty = Number(form.moq);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    return moqToBasePacks({
      quantity: qty,
      moqUnit: form.moqUnit,
      packsPerOuter: live.packsPerOuter,
    });
  }, [form.moq, form.moqUnit, live.packsPerOuter]);

  const stepConverted = useMemo(() => {
    const qty = Number(form.orderStep);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    return moqToBasePacks({
      quantity: qty,
      moqUnit: form.moqUnit,
      packsPerOuter: live.packsPerOuter,
    });
  }, [form.orderStep, form.moqUnit, live.packsPerOuter]);

  const applyPackQuantityChange = (packQuantity: string) => {
    const qty = Number(packQuantity);
    setForm((f) => {
      const nextName =
        !f.nameManual && Number.isFinite(qty) && qty > 0
          ? autoSkuDisplayName(productName, qty, f.packUnit)
          : f.name;
      const next = { ...f, packQuantity, name: nextName };
      const outerQty = Number(next.outerPackQty);
      const packs =
        next.outerPackQty.trim() !== ''
          ? packsPerOuterFromCount(outerQty)
          : null;
      const packsPerOuter =
        packs && !('error' in packs) ? packs.packsPerBox : null;
      return resetMoqUnitIfNeeded(next, packsPerOuter);
    });
  };

  const applyPackUnitChange = (packUnit: PackUnitKey) => {
    setForm((f) => {
      const qty = Number(f.packQuantity);
      const nextName =
        !f.nameManual && Number.isFinite(qty) && qty > 0
          ? autoSkuDisplayName(productName, qty, packUnit)
          : f.name;
      const next: SkuFormState = {
        ...f,
        packUnit,
        name: nextName,
        priceBasis: isPriceBasisCompatible(packUnit, f.priceBasis)
          ? f.priceBasis
          : defaultPriceBasisForPackUnit(packUnit),
      };
      const outerQty = Number(next.outerPackQty);
      const packs =
        next.outerPackQty.trim() !== ''
          ? packsPerOuterFromCount(outerQty)
          : null;
      const packsPerOuter =
        packs && !('error' in packs) ? packs.packsPerBox : null;
      return resetMoqUnitIfNeeded(next, packsPerOuter);
    });
  };

  const applyOuterChange = (
    patch: Partial<Pick<SkuFormState, 'outerPackQty' | 'outerType'>>,
  ) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      const outerQty = Number(next.outerPackQty);
      const packs =
        next.outerPackQty.trim() !== ''
          ? packsPerOuterFromCount(outerQty)
          : null;
      const packsPerOuter =
        packs && !('error' in packs) ? packs.packsPerBox : null;
      return resetMoqUnitIfNeeded(next, packsPerOuter);
    });
  };

  const onSubmit = async () => {
    const skuCode = form.skuCode.trim();
    if (!skuCode) {
      setError('SKU code is required');
      return;
    }
    if (!Number.isFinite(packQty) || packQty <= 0) {
      setError('Pack size must be greater than zero');
      return;
    }
    if (form.outerPackQty.trim() !== '') {
      if (live.boxError) {
        setError(live.boxError);
        return;
      }
      if (live.packsPerOuter == null || live.packsPerOuter <= 0) {
        setError('Outer packaging quantity must be greater than zero');
        return;
      }
    }
    if (!moqConverted || 'error' in moqConverted) {
      setError(
        moqConverted && 'error' in moqConverted
          ? moqConverted.error
          : 'Minimum order must be a positive number',
      );
      return;
    }

    const name =
      form.name.trim() ||
      autoSkuDisplayName(productName, packQty, form.packUnit);

    let packTradePrice: number | undefined;
    if (form.basisPrice.trim() !== '') {
      const basisPrice = Number(form.basisPrice);
      if (!Number.isFinite(basisPrice) || basisPrice <= 0) {
        setError('Price must be greater than zero');
        return;
      }
      if (!isPriceBasisCompatible(form.packUnit, form.priceBasis)) {
        setError(`Price basis is not valid for pack unit ${form.packUnit}`);
        return;
      }
      const converted = packTradePriceFromBasis({
        basisPrice,
        priceBasis: form.priceBasis,
        packQuantity: packQty,
        packUnit: form.packUnit,
      });
      if ('error' in converted) {
        setError(converted.error);
        return;
      }
      packTradePrice = converted.packTradePrice;
    }

    setError(null);

    const packsPerCarton =
      live.packsPerOuter != null ? live.packsPerOuter : undefined;
    const skuPayload = {
      skuCode,
      name,
      productType: 'PACKED' as const,
      sellingUnit: deriveSellingUnitForOrder({
        packUnit: form.packUnit,
        moqUnit: form.moqUnit,
        outerType: form.outerType,
      }),
      netQuantity: packQty,
      netQuantityUnit: form.packUnit,
      packsPerCarton,
      outerType: form.outerPackQty.trim() !== '' ? form.outerType : undefined,
      moq: moqConverted.packs,
      quantityStep:
        stepConverted && !('error' in stepConverted)
          ? stepConverted.packs
          : 1,
      isActive: form.isActive,
      hsnCode: form.hsnCode.trim() || null,
      gstRatePercent: form.gstRatePercent.trim()
        ? Number(form.gstRatePercent)
        : null,
    };

    if (editing) {
      updateSku.mutate(
        {
          id: editing.id,
          productId,
          input: skuPayload,
        },
        {
          onSuccess: async () => {
            if (packTradePrice != null) {
              try {
                await createPrice.mutateAsync({
                  skuId: editing.id,
                  tradePrice: packTradePrice,
                  currency: 'INR',
                });
              } catch (err) {
                setError(
                  formatMutationError(err, 'SKU saved but price update failed'),
                );
                return;
              }
            }
            setFormOpen(false);
          },
          onError: (err) =>
            setError(formatMutationError(err, 'Update failed')),
        },
      );
      return;
    }

    createSku.mutate(
      {
        productId,
        ...skuPayload,
      },
      {
        onSuccess: async (row) => {
          if (packTradePrice != null) {
            try {
              await createPrice.mutateAsync({
                skuId: row.id,
                tradePrice: packTradePrice,
                currency: 'INR',
              });
              setFormOpen(false);
              return;
            } catch (err) {
              setError(
                formatMutationError(
                  err,
                  'SKU created but price could not be set — use Set Price',
                ),
              );
              setFormOpen(false);
              onSkuCreatedWithoutPrice?.(row.id);
              return;
            }
          }
          setFormOpen(false);
          onSkuCreatedWithoutPrice?.(row.id);
        },
        onError: (err) =>
          setError(formatMutationError(err, 'Create failed')),
      },
    );
  };

  return (
    <div className="ga-sku-tab">
      <div className="ga-sku-tab__toolbar">
        {canManage ? (
          <Button variant="primary" onClick={openCreate}>
            Add SKU
          </Button>
        ) : null}
      </div>
      {rowError ? <p className="ga-sku-tab__error">{rowError}</p> : null}

      {skus.length === 0 ? (
        <EmptyState
          title="No selling packs yet"
          detail="Add a pack size (for example 5 kg or 1 litre bottle) so customers can order this product."
        />
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Selling Pack</th>
                <th>Code</th>
                <th>Customer Price</th>
                <th>Outer Pack</th>
                <th>MOQ</th>
                <th>Stock</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {skus.map((sku) => {
                const packLabel =
                  sku.netQuantity && sku.netQuantityUnit
                    ? formatPackLabel(sku.netQuantity, sku.netQuantityUnit)
                    : sku.name;
                const moqLabel = minimumOrderSummary({
                  moq: sku.moq,
                  packQuantity: sku.netQuantity ?? 1,
                  packUnit: sku.netQuantityUnit,
                  packsPerOuter: sku.packsPerCarton,
                  outerType: sku.outerType,
                });
                const outerLabel =
                  sku.packsPerCarton && sku.outerType
                    ? `${sku.packsPerCarton} packs / ${OUTER_PACKAGES[sku.outerType as OuterPackageKey]?.label.toLowerCase() ?? sku.outerType}`
                    : '—';

                return (
                  <tr key={sku.id}>
                    <td>
                      <span className="ga-table__primary">{sku.name}</span>
                      <div className="ga-sku-tab__sub">{packLabel}</div>
                    </td>
                    <td className="ga-table__mono">{sku.skuCode}</td>
                    <td>
                      {sku.currentTradePriceLabel === '—' && sku.isActive ? (
                        <Link
                          to={`/pricing/${sku.id}`}
                          className="ga-sku-tab__price-link"
                        >
                          Set Price
                        </Link>
                      ) : (
                        sku.currentTradePriceLabel
                      )}
                    </td>
                    <td>{outerLabel}</td>
                    <td>{moqLabel.replace(/^Minimum order: /i, '')}</td>
                    <td>
                      <InventoryStatusBadge status={sku.inventoryStatus} />
                      <div className="ga-sku-tab__sub">{sku.availableLabel}</div>
                    </td>
                    <td>
                      <Badge tone={sku.isActive ? 'success' : 'neutral'}>
                        {sku.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      {canManage ? (
                        <div className="ga-sku-tab__row-actions">
                          <Button
                            variant="secondary"
                            onClick={() => openEdit(sku)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setRowError(null);
                              updateSku.mutate(
                                {
                                  id: sku.id,
                                  productId,
                                  input: { isActive: !sku.isActive },
                                },
                                {
                                  onError: (err) =>
                                    setRowError(
                                      formatMutationError(err, 'Update failed'),
                                    ),
                                },
                              );
                            }}
                          >
                            {sku.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setRowError(null);
                              softDeleteSku.mutate(
                                { id: sku.id, productId },
                                {
                                  onError: (err) =>
                                    setRowError(
                                      formatMutationError(err, 'Delete failed'),
                                    ),
                                },
                              );
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={formOpen && canManage}
        title={editing ? 'Edit Selling Pack' : 'Add Selling Pack'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setFormOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void onSubmit()}
              disabled={pending}
            >
              {pending ? 'Saving…' : editing ? 'Save Changes' : 'Create Pack'}
            </Button>
          </>
        }
      >
        <div className="ga-sku-form ga-sku-form--simple">
          <section className="ga-sku-form__section">
            <h3 className="ga-sku-form__section-title">Selling pack</h3>
            <p className="ga-sku-form__section-hint">
              Product: <strong>{productName}</strong>
            </p>
            <div className="ga-sku-form__row">
              <TextField
                label="Pack Size"
                type="number"
                min={0}
                step="any"
                value={form.packQuantity}
                onChange={(e) => applyPackQuantityChange(e.target.value)}
                required
              />
              <SelectField
                label="Pack Unit"
                value={form.packUnit}
                onChange={(packUnit) =>
                  applyPackUnitChange(packUnit as PackUnitKey)
                }
              >
                {unitGroups.map((group) => (
                  <optgroup key={group.category} label={group.label}>
                    {group.units.map((u) => (
                      <option key={u.key} value={u.key}>
                        {u.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </SelectField>
            </div>
            {Number.isFinite(packQty) && packQty > 0 ? (
              <p className="ga-sku-form__live">
                Selling pack ={' '}
                <strong>{formatPackLabel(packQty, form.packUnit)}</strong>
              </p>
            ) : null}
            <TextField
              label="SKU Code"
              value={form.skuCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, skuCode: e.target.value }))
              }
              placeholder="e.g. ALM-250G"
              required
            />
            <TextField
              label="Display Name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                  nameManual: true,
                }))
              }
              placeholder={autoSkuDisplayName(productName, 250, 'g')}
            />
          </section>

          <section className="ga-sku-form__section">
            <h3 className="ga-sku-form__section-title">
              Outer packaging (optional)
            </h3>
            <div className="ga-sku-form__row">
              <TextField
                label="Packs per outer package"
                type="number"
                min={0}
                step={1}
                value={form.outerPackQty}
                onChange={(e) =>
                  applyOuterChange({ outerPackQty: e.target.value })
                }
                placeholder="e.g. 10"
              />
              <SelectField
                label="Outer package type"
                value={form.outerType}
                onChange={(outerType) =>
                  applyOuterChange({
                    outerType: outerType as OuterPackageKey,
                  })
                }
              >
                {OUTER_PACKAGE_OPTIONS.map((key) => (
                  <option key={key} value={key}>
                    {OUTER_PACKAGES[key].label}
                  </option>
                ))}
              </SelectField>
            </div>
            {live.outerSummary ? (
              <p className="ga-sku-form__live">
                <strong>{live.outerSummary.packsLine}</strong>
                {live.outerSummary.contentsLine
                  ? ` · ${live.outerSummary.contentsLine}`
                  : ''}
              </p>
            ) : null}
            {live.boxError ? (
              <p className="ga-sku-tab__error">{live.boxError}</p>
            ) : null}
          </section>

          <section className="ga-sku-form__section">
            <h3 className="ga-sku-form__section-title">Price</h3>
            <div className="ga-sku-form__row">
              <SelectField
                label="Price Basis"
                value={form.priceBasis}
                onChange={(priceBasis) =>
                  setForm((f) => ({
                    ...f,
                    priceBasis: priceBasis as PriceBasis,
                  }))
                }
              >
                {basisOptions.map((basis) => (
                  <option key={basis} value={basis}>
                    {priceBasisLabel(basis)}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Basis price (₹)"
                type="number"
                min={0}
                step="any"
                value={form.basisPrice}
                onChange={(e) =>
                  setForm((f) => ({ ...f, basisPrice: e.target.value }))
                }
                placeholder="e.g. 1000"
              />
            </div>
            {live.packTradePrice != null ? (
              <p className="ga-sku-form__live">
                Customer pack price:{' '}
                <strong>
                  ₹{live.packTradePrice.toFixed(2)} /{' '}
                  {formatPackLabel(packQty, form.packUnit)}
                </strong>
              </p>
            ) : null}
            {live.packError ? (
              <p className="ga-sku-tab__error">{live.packError}</p>
            ) : null}
          </section>

          <section className="ga-sku-form__section">
            <h3 className="ga-sku-form__section-title">Sales unit</h3>
            <div className="ga-sku-form__row">
              <TextField
                label="Minimum order"
                type="number"
                min={0}
                step="any"
                value={form.moq}
                onChange={(e) =>
                  setForm((f) => ({ ...f, moq: e.target.value }))
                }
              />
              <SelectField
                label="Order unit"
                value={form.moqUnit}
                onChange={(moqUnit) =>
                  setForm((f) => ({
                    ...f,
                    moqUnit: moqUnit as MoqUnitValue,
                  }))
                }
              >
                {moqOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextField
              label="Order step"
              type="number"
              min={0}
              step="any"
              value={form.orderStep}
              onChange={(e) =>
                setForm((f) => ({ ...f, orderStep: e.target.value }))
              }
            />
            <TextField
              label="HSN code"
              value={form.hsnCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, hsnCode: e.target.value }))
              }
              hint="Optional · 4–8 digits"
            />
            <TextField
              label="GST %"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.gstRatePercent}
              onChange={(e) =>
                setForm((f) => ({ ...f, gstRatePercent: e.target.value }))
              }
              hint="Optional"
            />
            {moqConverted && !('error' in moqConverted) ? (
              <p className="ga-sku-form__section-hint">
                {minimumOrderSummary({
                  moq: moqConverted.packs,
                  packQuantity: packQty,
                  packUnit: form.packUnit,
                  packsPerOuter: live.packsPerOuter,
                  outerType: form.outerType,
                  displayUnit: form.moqUnit,
                  displayQuantity: Number(form.moq),
                })}
              </p>
            ) : null}
            <SelectField
              label="Status"
              value={form.isActive ? 'active' : 'inactive'}
              onChange={(v) =>
                setForm((f) => ({ ...f, isActive: v === 'active' }))
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SelectField>
          </section>

          {error ? <p className="ga-sku-tab__error">{error}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
