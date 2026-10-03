import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useAdminDataClient } from '@/data/AdminDataProviders';
import {
  usePurchaseBillScanQuery,
  useSuppliersListQuery,
  useWarehousesListQuery,
} from '@/data/hooks';
import {
  useConfirmPurchaseBillScanMutation,
  useDiscardPurchaseBillScanMutation,
  useSavePurchaseBillScanExtractMutation,
} from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import {
  applyBillExtractMatches,
  emptyBillExtract,
  type BillExtractDraft,
  type BillExtractLine,
} from '@/data/bill-extract';
import {
  GST_SUPPLY_TYPE_LABELS,
  splitGstTaxAmount,
  type GstSupplyType,
} from '@/data/gst';
import { formatInr } from '@/data/live/format';
import { PURCHASING_SECTION_LINKS } from '@/data/purchasing';
import '@groaurum/ui/styles/data-table.css';
import './PurchasingPages.css';

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function newLine(): BillExtractLine {
  return {
    description: '',
    quantity: 1,
    unitCost: 0,
    skuCodeHint: null,
    matchedSkuId: null,
    matchConfidence: 'none',
  };
}

export function BillScanReviewPage() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const client = useAdminDataClient();

  const scanQuery = usePurchaseBillScanQuery(scanId);
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

  const saveMutation = useSavePurchaseBillScanExtractMutation();
  const confirmMutation = useConfirmPurchaseBillScanMutation();
  const discardMutation = useDiscardPurchaseBillScanMutation();

  const [warehouseId, setWarehouseId] = useState('');
  const [extract, setExtract] = useState<BillExtractDraft>(emptyBillExtract());
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplierCandidates = useMemo(
    () =>
      (suppliersQuery.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        gstin: s.gstin,
      })),
    [suppliersQuery.data],
  );

  const skuCandidates = useMemo(
    () =>
      (skusQuery.data ?? []).map((s) => ({
        id: s.id,
        skuCode: s.skuCode,
        name: s.name,
      })),
    [skusQuery.data],
  );

  const skuOptions = useMemo(
    () =>
      (skusQuery.data ?? []).map((sku) => ({
        id: sku.id,
        label: `${sku.skuCode} · ${sku.name}`,
      })),
    [skusQuery.data],
  );

  useEffect(() => {
    if (!scanQuery.data || hydrated) return;
    setExtract(scanQuery.data.extract);
    setHydrated(true);
  }, [scanQuery.data, hydrated]);

  useEffect(() => {
    const warehouses = warehousesQuery.data ?? [];
    if (!warehouseId && warehouses.length === 1) {
      setWarehouseId(warehouses[0]!.id);
    }
  }, [warehousesQuery.data, warehouseId]);

  const taxSplit = splitGstTaxAmount(
    Number(extract.taxAmount ?? 0) || 0,
    extract.supplyType ?? 'UNSET',
  );

  const readOnly =
    scanQuery.data?.status === 'CONFIRMED' ||
    scanQuery.data?.status === 'DISCARDED';

  const rematch = () => {
    setExtract((prev) =>
      applyBillExtractMatches(prev, supplierCandidates, skuCandidates),
    );
  };

  const updateLine = (index: number, patch: Partial<BillExtractLine>) => {
    setExtract((prev) => {
      const lines = prev.lines.map((line, i) =>
        i === index ? { ...line, ...patch } : line,
      );
      return { ...prev, lines };
    });
  };

  const onSaveExtract = async () => {
    if (!scanId) return;
    setError(null);
    try {
      await saveMutation.mutateAsync({ scanId, extract });
    } catch (err) {
      setError(formatMutationError(err, 'Could not save extract'));
    }
  };

  const onConfirm = async () => {
    if (!scanId) return;
    setError(null);
    try {
      const matchedLines = extract.lines.filter(
        (line) =>
          line.matchedSkuId &&
          (line.quantity ?? 0) > 0 &&
          (line.unitCost ?? 0) >= 0,
      );
      if (!extract.matchedSupplierId) {
        throw new Error('Choose a matched supplier before confirming');
      }
      if (!warehouseId) {
        throw new Error('Choose a warehouse before confirming');
      }
      if (!extract.billNumber?.trim()) {
        throw new Error('Bill number is required');
      }
      if (!matchedLines.length) {
        throw new Error('Add at least one line with a matched SKU');
      }

      const saved = await saveMutation.mutateAsync({ scanId, extract });
      const result = await confirmMutation.mutateAsync({
        scanId: saved.id,
        draft: {
          supplierId: extract.matchedSupplierId,
          warehouseId,
          purchaseDate: (extract.purchaseDate || todayYmd()).slice(0, 10),
          billNumber: extract.billNumber.trim(),
          taxAmount: Number(extract.taxAmount ?? 0) || 0,
          notes: extract.notes?.trim() || `From bill photo (${extract.extractorLabel})`,
          supplyType: extract.supplyType ?? 'UNSET',
          cgstAmount: taxSplit.cgstAmount,
          sgstAmount: taxSplit.sgstAmount,
          igstAmount: taxSplit.igstAmount,
          items: matchedLines.map((line) => ({
            skuId: line.matchedSkuId!,
            quantity: Number(line.quantity),
            unitCost: Number(line.unitCost ?? 0),
          })),
        },
      });
      navigate(`/purchases/${result.purchase.id}`);
    } catch (err) {
      setError(formatMutationError(err, 'Could not create purchase draft'));
    }
  };

  const onDiscard = async () => {
    if (!scanId) return;
    setError(null);
    try {
      await discardMutation.mutateAsync(scanId);
      navigate('/purchases');
    } catch (err) {
      setError(formatMutationError(err, 'Could not discard scan'));
    }
  };

  if (!canManage) {
    return (
      <div className="ga-purchasing">
        <PageHeader title="Review bill photo" subtitle="Permission required" />
        <p className="ga-purchasing__error">
          You need payments manage permission to review bill photos.
        </p>
      </div>
    );
  }

  return (
    <QueryStateGate
      title="Review bill photo"
      state={scanQuery.state}
      emptyTitle="Bill scan not found"
      emptyDetail="This scan may have been discarded or the link is wrong."
    >
      {(scan) => (
        <div className="ga-purchasing">
          <PageHeader
            title="Review bill photo"
            subtitle={`Extractor: ${scan.extractorLabel} · Status: ${scan.status}`}
            meta={scan.createdAtLabel}
            actions={
              scan.purchaseId ? (
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/purchases/${scan.purchaseId}`)}
                >
                  Open purchase draft
                </Button>
              ) : undefined
            }
          />
          <SectionRelatedLinks
            label="Purchasing"
            links={[...PURCHASING_SECTION_LINKS]}
          />

          <section className="ga-purchasing__card ga-purchasing__scan-layout">
            <div>
              <h2>Photo</h2>
              {scan.imageUrl ? (
                <img
                  className="ga-purchasing__bill-image"
                  src={scan.imageUrl}
                  alt="Uploaded supplier bill"
                />
              ) : (
                <p className="ga-purchasing__note">No photo attached.</p>
              )}
              <p className="ga-purchasing__muted">
                Manual review required. Confirm creates a purchase draft only —
                stock is not received until you receive on the purchase page.
              </p>
            </div>

            <div>
              <div className="ga-purchasing__card-head">
                <h2>Bill fields</h2>
                {!readOnly ? (
                  <Button variant="ghost" onClick={rematch}>
                    Re-match supplier / SKUs
                  </Button>
                ) : null}
              </div>

              <div className="ga-purchasing__form-grid">
                <label>
                  Supplier name hint
                  <input
                    value={extract.supplierNameHint ?? ''}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        supplierNameHint: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Supplier GSTIN hint
                  <input
                    value={extract.supplierGstinHint ?? ''}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        supplierGstinHint: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Matched supplier
                  <select
                    value={extract.matchedSupplierId ?? ''}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        matchedSupplierId: e.target.value || null,
                        supplierMatchConfidence: e.target.value
                          ? 'exact'
                          : 'none',
                      }))
                    }
                  >
                    <option value="">Select supplier</option>
                    {(suppliersQuery.data ?? [])
                      .filter(
                        (s) =>
                          s.isActive || s.id === extract.matchedSupplierId,
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {extract.supplierMatchConfidence &&
                          extract.matchedSupplierId === s.id
                            ? ` (${extract.supplierMatchConfidence})`
                            : ''}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Warehouse
                  <select
                    value={warehouseId}
                    disabled={readOnly}
                    onChange={(e) => setWarehouseId(e.target.value)}
                  >
                    <option value="">Select warehouse</option>
                    {(warehousesQuery.data ?? []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Bill number
                  <input
                    value={extract.billNumber ?? ''}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        billNumber: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Purchase date
                  <input
                    type="date"
                    value={extract.purchaseDate ?? todayYmd()}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        purchaseDate: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Tax amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={extract.taxAmount ?? 0}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        taxAmount: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
                <label>
                  GST supply
                  <select
                    value={extract.supplyType ?? 'UNSET'}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        supplyType: e.target.value as GstSupplyType,
                      }))
                    }
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
              {Number(extract.taxAmount ?? 0) > 0 &&
              extract.supplyType &&
              extract.supplyType !== 'UNSET' ? (
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
                  value={extract.notes ?? ''}
                  disabled={readOnly}
                  onChange={(e) =>
                    setExtract((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </section>

          <section className="ga-purchasing__card">
            <div className="ga-purchasing__card-head">
              <h2>Line items</h2>
              {!readOnly ? (
                <Button
                  variant="secondary"
                  onClick={() =>
                    setExtract((prev) => ({
                      ...prev,
                      lines: [...prev.lines, newLine()],
                    }))
                  }
                >
                  Add line
                </Button>
              ) : null}
            </div>

            {extract.lines.length === 0 ? (
              <p className="ga-purchasing__note">
                No lines yet — add items from the bill (manual entry).
              </p>
            ) : (
              <div className="ga-table-wrap">
                <table className="ga-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>SKU code hint</th>
                      <th>Matched SKU</th>
                      <th>Qty</th>
                      <th>Unit cost</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {extract.lines.map((line, index) => (
                      <tr key={`line-${index}`}>
                        <td>
                          <input
                            value={line.description}
                            disabled={readOnly}
                            onChange={(e) =>
                              updateLine(index, {
                                description: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={line.skuCodeHint ?? ''}
                            disabled={readOnly}
                            onChange={(e) =>
                              updateLine(index, {
                                skuCodeHint: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <select
                            value={line.matchedSkuId ?? ''}
                            disabled={readOnly}
                            onChange={(e) =>
                              updateLine(index, {
                                matchedSkuId: e.target.value || null,
                                matchConfidence: e.target.value
                                  ? 'exact'
                                  : 'none',
                              })
                            }
                          >
                            <option value="">Select SKU</option>
                            {skuOptions.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                                {line.matchedSkuId === o.id &&
                                line.matchConfidence
                                  ? ` (${line.matchConfidence})`
                                  : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={line.quantity ?? ''}
                            disabled={readOnly}
                            onChange={(e) =>
                              updateLine(index, {
                                quantity:
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitCost ?? ''}
                            disabled={readOnly}
                            onChange={(e) =>
                              updateLine(index, {
                                unitCost:
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          {!readOnly ? (
                            <Button
                              variant="ghost"
                              onClick={() =>
                                setExtract((prev) => ({
                                  ...prev,
                                  lines: prev.lines.filter(
                                    (_, i) => i !== index,
                                  ),
                                }))
                              }
                            >
                              Remove
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {error ? <p className="ga-purchasing__error">{error}</p> : null}

          {!readOnly ? (
            <div className="ga-purchasing__actions">
              <Button
                variant="secondary"
                disabled={
                  saveMutation.isPending ||
                  confirmMutation.isPending ||
                  discardMutation.isPending
                }
                onClick={() => void onSaveExtract()}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save review'}
              </Button>
              <Button
                variant="primary"
                disabled={
                  saveMutation.isPending ||
                  confirmMutation.isPending ||
                  discardMutation.isPending
                }
                onClick={() => void onConfirm()}
              >
                {confirmMutation.isPending
                  ? 'Creating draft…'
                  : 'Confirm → create draft'}
              </Button>
              <Button
                variant="ghost"
                disabled={discardMutation.isPending}
                onClick={() => void onDiscard()}
              >
                Discard
              </Button>
              <Button variant="ghost" onClick={() => navigate('/purchases')}>
                Back
              </Button>
            </div>
          ) : (
            <div className="ga-purchasing__actions">
              {scan.purchaseId ? (
                <Link to={`/purchases/${scan.purchaseId}`}>
                  Open linked purchase
                </Link>
              ) : null}
              <Button variant="ghost" onClick={() => navigate('/purchases')}>
                Back to purchases
              </Button>
            </div>
          )}
        </div>
      )}
    </QueryStateGate>
  );
}
