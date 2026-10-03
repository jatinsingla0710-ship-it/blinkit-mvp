import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAdminDataClient } from '@/data/AdminDataProviders';
import {
  usePurchaseDetailQuery,
  useSuppliersListQuery,
  useWarehousesListQuery,
} from '@/data/hooks';
import { useUpsertPurchaseDraftMutation } from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import { formatInr } from '@/data/live/format';
import {
  purchaseTotals,
  PURCHASING_SECTION_LINKS,
  type PurchaseItemInput,
} from '@/data/purchasing';
import {
  GST_SUPPLY_TYPE_LABELS,
  splitGstTaxAmount,
  type GstSupplyType,
} from '@/data/gst';
import '@groaurum/ui/styles/data-table.css';
import './PurchasingPages.css';

type LineDraft = PurchaseItemInput & {
  key: string;
  label: string;
};

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function PurchaseFormPage() {
  const { purchaseId } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(purchaseId);
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const client = useAdminDataClient();

  const suppliersQuery = useSuppliersListQuery();
  const warehousesQuery = useWarehousesListQuery();
  const skusQuery = useQuery({
    queryKey: ['groaurum', 'purchases', 'sku-options'],
    enabled: Boolean(client.liveApi),
    queryFn: () => {
      if (!client.liveApi) throw new Error('Live API required');
      return client.liveApi.skuList();
    },
  });
  const existingQuery = usePurchaseDetailQuery(isEdit ? purchaseId : undefined);
  const saveMutation = useUpsertPurchaseDraftMutation();

  const [supplierId, setSupplierId] = useState(
    searchParams.get('supplierId') ?? '',
  );
  const [warehouseId, setWarehouseId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayYmd());
  const [billNumber, setBillNumber] = useState('');
  const [taxAmount, setTaxAmount] = useState('0');
  const [supplyType, setSupplyType] = useState<GstSupplyType>('UNSET');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [skuId, setSkuId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!isEdit);

  const skuOptions = useMemo(
    () =>
      (skusQuery.data ?? []).map((sku) => ({
        id: sku.id,
        label: `${sku.skuCode} · ${sku.name}`,
      })),
    [skusQuery.data],
  );

  useEffect(() => {
    if (!isEdit || !existingQuery.data || hydrated) return;
    const p = existingQuery.data;
    if (!p.canEdit) {
      navigate(`/purchases/${p.id}`, { replace: true });
      return;
    }
    setSupplierId(p.supplierId);
    setWarehouseId(p.warehouseId);
    setPurchaseDate(p.purchaseDate);
    setBillNumber(p.billNumber);
    setTaxAmount(String(p.taxAmount));
    setSupplyType(p.supplyType ?? 'UNSET');
    setNotes(p.notes ?? '');
    setLines(
      p.items.map((item) => ({
        key: item.id,
        skuId: item.skuId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        label: `${item.productName} · ${item.skuCode}`,
      })),
    );
    setHydrated(true);
  }, [isEdit, existingQuery.data, hydrated, navigate]);

  useEffect(() => {
    if (warehouseId) return;
    const warehouses = warehousesQuery.data ?? [];
    const first = Array.isArray(warehouses) ? warehouses[0] : null;
    if (first && typeof first === 'object' && 'id' in first) {
      setWarehouseId(String((first as { id: string }).id));
    }
  }, [warehousesQuery.data, warehouseId]);

  const totals = useMemo(
    () => purchaseTotals(lines, Number(taxAmount) || 0),
    [lines, taxAmount],
  );

  const taxSplit = useMemo(
    () => splitGstTaxAmount(Number(taxAmount) || 0, supplyType),
    [taxAmount, supplyType],
  );

  const addLine = () => {
    setError(null);
    const qty = Number(quantity);
    const cost = Number(unitCost);
    if (!skuId) {
      setError('Select a SKU');
      return;
    }
    if (!(qty > 0)) {
      setError('Quantity must be greater than 0');
      return;
    }
    if (!(cost >= 0) || Number.isNaN(cost)) {
      setError('Unit cost must be zero or positive');
      return;
    }
    const label = skuOptions.find((o) => o.id === skuId)?.label ?? skuId;
    setLines((prev) => [
      ...prev,
      {
        key: `${skuId}-${Date.now()}`,
        skuId,
        quantity: qty,
        unitCost: cost,
        label,
      },
    ]);
    setSkuId('');
    setQuantity('1');
    setUnitCost('');
  };

  const onSave = async (openReceive: boolean) => {
    setError(null);
    if (!canManage) {
      setError('You do not have permission to manage purchases');
      return;
    }
    if (!supplierId || !warehouseId || !billNumber.trim() || lines.length === 0) {
      setError(
        'Supplier, warehouse, bill number, and at least one item are required',
      );
      return;
    }
    try {
      const saved = await saveMutation.mutateAsync({
        purchaseId: purchaseId ?? null,
        supplierId,
        warehouseId,
        purchaseDate,
        billNumber,
        taxAmount: Number(taxAmount) || 0,
        supplyType,
        cgstAmount: taxSplit.cgstAmount,
        sgstAmount: taxSplit.sgstAmount,
        igstAmount: taxSplit.igstAmount,
        notes,
        items: lines.map((l) => ({
          skuId: l.skuId,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
      });
      navigate(
        openReceive
          ? `/purchases/${saved.id}?receive=1`
          : `/purchases/${saved.id}`,
      );
    } catch (err) {
      setError(formatMutationError(err, 'Could not save purchase'));
    }
  };

  if (!canManage) {
    return (
      <div className="ga-purchasing">
        <PageHeader title="Purchase" subtitle="Permission required" />
        <p className="ga-purchasing__error">
          You need payments manage permission to create purchases.
        </p>
      </div>
    );
  }

  const suppliers = suppliersQuery.data ?? [];
  const warehouses = [...(warehousesQuery.data ?? [])];

  return (
    <div className="ga-purchasing">
      <PageHeader
        title={isEdit ? 'Edit purchase draft' : 'New purchase'}
        subtitle="Buy stock from a supplier — cost is saved for later valuation"
      />
      <SectionRelatedLinks
        label="Purchasing"
        links={[...PURCHASING_SECTION_LINKS]}
      />

      <section className="ga-purchasing__card">
        <div className="ga-purchasing__form-grid">
          <label>
            Supplier
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">Select supplier</option>
              {suppliers
                .filter((s) => s.isActive || s.id === supplierId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Warehouse
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">Select warehouse</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Purchase date
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </label>
          <label>
            Bill / invoice number
            <input
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              placeholder="Supplier bill no."
            />
          </label>
          <label>
            Tax amount (optional)
            <input
              type="number"
              min="0"
              step="0.01"
              value={taxAmount}
              onChange={(e) => setTaxAmount(e.target.value)}
            />
          </label>
          <label>
            GST supply
            <select
              value={supplyType}
              onChange={(e) => setSupplyType(e.target.value as GstSupplyType)}
            >
              {(Object.keys(GST_SUPPLY_TYPE_LABELS) as GstSupplyType[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {GST_SUPPLY_TYPE_LABELS[key]}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        {Number(taxAmount) > 0 && supplyType !== 'UNSET' ? (
          <p className="ga-purchasing__hint">
            Split: CGST {formatInr(taxSplit.cgstAmount)} · SGST{' '}
            {formatInr(taxSplit.sgstAmount)} · IGST{' '}
            {formatInr(taxSplit.igstAmount)}
          </p>
        ) : null}
        <label>
          Notes
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </section>

      <section className="ga-purchasing__card">
        <h2>Add items</h2>
        <div className="ga-purchasing__line-actions">
          <label>
            SKU
            <select value={skuId} onChange={(e) => setSkuId(e.target.value)}>
              <option value="">Select SKU</option>
              {skuOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Qty
            <input
              type="number"
              min="0.001"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label>
            Unit cost
            <input
              type="number"
              min="0"
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="Purchase cost"
            />
          </label>
          <Button variant="secondary" onClick={addLine}>
            Add line
          </Button>
        </div>

        {lines.length === 0 ? (
          <p className="ga-purchasing__note">No items yet.</p>
        ) : (
          <div className="ga-table-wrap">
            <table className="ga-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit cost</th>
                  <th>Line total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key}>
                    <td>{line.label}</td>
                    <td>{line.quantity}</td>
                    <td>{formatInr(line.unitCost)}</td>
                    <td>{formatInr(line.quantity * line.unitCost)}</td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setLines((prev) =>
                            prev.filter((l) => l.key !== line.key),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="ga-purchasing__totals">
          <span>Subtotal: {formatInr(totals.subtotal)}</span>
          <span>Tax: {formatInr(totals.taxAmount)}</span>
          <span>Total: {formatInr(totals.total)}</span>
        </div>
      </section>

      {error ? <p className="ga-purchasing__error">{error}</p> : null}

      <div className="ga-purchasing__actions">
        <Button
          variant="secondary"
          disabled={saveMutation.isPending}
          onClick={() => void onSave(false)}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save draft'}
        </Button>
        <Button
          variant="primary"
          disabled={saveMutation.isPending}
          onClick={() => void onSave(true)}
        >
          Save & open to receive
        </Button>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>
    </div>
  );
}
