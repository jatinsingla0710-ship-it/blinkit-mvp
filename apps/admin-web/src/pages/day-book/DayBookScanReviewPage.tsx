import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import {
  useDayBookScanQuery,
  useSuppliersListQuery,
  useCustomersSnapshotQuery,
} from '@/data/hooks';
import {
  useConfirmDayBookScanMutation,
  useDiscardDayBookScanMutation,
  useSaveDayBookScanExtractMutation,
} from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import {
  applyDayBookMatches,
  emptyDayBookExtract,
  type DayBookExtractDraft,
  type DayBookLineDecision,
  type DayBookLineKind,
  type DayBookProposedLine,
} from '@/data/day-book-extract';
import {
  COMPANY_EXPENSE_CATEGORIES,
  COMPANY_EXPENSE_CATEGORY_LABELS,
  todayExpenseDate,
  type CompanyExpenseCategory,
} from '@/data/company-expenses';
import { formatInr } from '@/data/live/format';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import '@groaurum/ui/styles/data-table.css';
import './DayBookPage.css';

const KIND_LABELS: Record<DayBookLineKind, string> = {
  collection: 'Collection',
  expense: 'Expense',
  supplier_payment: 'Supplier payment',
  unknown: 'Unknown',
};

export function DayBookScanReviewPage() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const scanQuery = useDayBookScanQuery(scanId);
  const suppliersQuery = useSuppliersListQuery();
  const customersQuery = useCustomersSnapshotQuery();

  const saveMutation = useSaveDayBookScanExtractMutation();
  const confirmMutation = useConfirmDayBookScanMutation();
  const discardMutation = useDiscardDayBookScanMutation();

  const [extract, setExtract] = useState<DayBookExtractDraft>(
    emptyDayBookExtract(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanQuery.data || hydrated) return;
    setExtract({
      ...scanQuery.data.extract,
      entryDate: scanQuery.data.extract.entryDate || todayExpenseDate(),
    });
    setHydrated(true);
  }, [scanQuery.data, hydrated]);

  const customerOptions = useMemo(
    () =>
      (customersQuery.data?.rows ?? []).map((r) => ({
        id: r.id,
        shopName: r.shopName,
        ownerName: r.ownerName,
      })),
    [customersQuery.data],
  );

  const supplierOptions = useMemo(
    () =>
      (suppliersQuery.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        gstin: s.gstin,
      })),
    [suppliersQuery.data],
  );

  const readOnly =
    scanQuery.data?.status === 'CONFIRMED' ||
    scanQuery.data?.status === 'DISCARDED';

  const updateLine = (
    id: string,
    patch: Partial<DayBookProposedLine>,
  ) => {
    setExtract((prev) => ({
      ...prev,
      lines: prev.lines.map((line) =>
        line.id === id ? { ...line, ...patch } : line,
      ),
    }));
  };

  const rematch = () => {
    setExtract((prev) =>
      applyDayBookMatches(prev, customerOptions, supplierOptions),
    );
  };

  const onSave = async () => {
    if (!scanId) return;
    setError(null);
    try {
      await saveMutation.mutateAsync({ scanId, extract });
    } catch (err) {
      setError(formatMutationError(err, 'Could not save review'));
    }
  };

  const onConfirm = async () => {
    if (!scanId) return;
    setError(null);
    try {
      const includable = extract.lines.filter((l) => l.decision === 'include');
      for (const line of includable) {
        if (line.kind === 'collection' || line.kind === 'unknown') {
          throw new Error(
            `Cannot post "${line.rawText}" — set kind to expense or supplier payment, or mark skip / needs order`,
          );
        }
      }
      await saveMutation.mutateAsync({ scanId, extract });
      await confirmMutation.mutateAsync({ scanId, extract });
      navigate('/day-book');
    } catch (err) {
      setError(formatMutationError(err, 'Could not confirm day book lines'));
    }
  };

  const onDiscard = async () => {
    if (!scanId) return;
    setError(null);
    try {
      await discardMutation.mutateAsync(scanId);
      navigate('/day-book');
    } catch (err) {
      setError(formatMutationError(err, 'Could not discard scan'));
    }
  };

  if (!canManage) {
    return (
      <div className="ga-daybook">
        <PageHeader title="Review daily book" subtitle="Permission required" />
        <p className="ga-daybook__error">
          You need payments manage permission to review daily book lines.
        </p>
      </div>
    );
  }

  return (
    <QueryStateGate
      title="Review daily book"
      state={scanQuery.state}
      emptyTitle="Day book scan not found"
      emptyDetail="This scan may have been discarded or the link is wrong."
    >
      {(scan) => (
        <div className="ga-daybook">
          <PageHeader
            title="Review daily book"
            subtitle={`Extractor: ${scan.extractorLabel} · Status: ${scan.status}`}
            meta={scan.createdAtLabel}
          />
          <SectionRelatedLinks
            label="Accounting"
            links={[...ACCOUNTING_SECTION_LINKS]}
          />

          <section className="ga-daybook__card ga-daybook__scan-layout">
            <div>
              <h2>Source</h2>
              {scan.imageUrl ? (
                <img
                  className="ga-daybook__scan-image"
                  src={scan.imageUrl}
                  alt="Uploaded daily book photo"
                />
              ) : null}
              <pre className="ga-daybook__source">
                {scan.sourceText || 'No pasted text.'}
              </pre>
              <p className="ga-daybook__muted">
                Line rules only — not AI. Confirm posts expenses and supplier
                payments. Collections stay as proposals until you open the
                customer and choose an order.
              </p>
            </div>

            <div>
              <div className="ga-daybook__card-head">
                <h2>Proposed lines</h2>
                {!readOnly ? (
                  <Button variant="ghost" onClick={rematch}>
                    Re-match parties
                  </Button>
                ) : null}
              </div>
              <label>
                Entry date
                <input
                  type="date"
                  value={extract.entryDate ?? todayExpenseDate()}
                  disabled={readOnly}
                  onChange={(e) =>
                    setExtract((prev) => ({
                      ...prev,
                      entryDate: e.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </section>

          <section className="ga-daybook__card">
            {extract.lines.length === 0 ? (
              <p className="ga-daybook__note">
                No lines parsed. Go back and paste text, or edit after adding
                lines manually in a future pass.
              </p>
            ) : (
              <div className="ga-table-wrap">
                <table className="ga-table">
                  <thead>
                    <tr>
                      <th>Raw</th>
                      <th>Kind</th>
                      <th>Amount</th>
                      <th>Party / match</th>
                      <th>Decision</th>
                      <th>Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extract.lines.map((line) => (
                      <tr key={line.id}>
                        <td>
                          <div className="ga-daybook__raw">{line.rawText}</div>
                          {line.kind === 'expense' && !readOnly ? (
                            <select
                              value={line.expenseCategory ?? 'OTHER'}
                              onChange={(e) =>
                                updateLine(line.id, {
                                  expenseCategory: e.target
                                    .value as CompanyExpenseCategory,
                                })
                              }
                            >
                              {COMPANY_EXPENSE_CATEGORIES.map((key) => (
                                <option key={key} value={key}>
                                  {COMPANY_EXPENSE_CATEGORY_LABELS[key]}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </td>
                        <td>
                          <select
                            value={line.kind}
                            disabled={readOnly}
                            onChange={(e) => {
                              const kind = e.target.value as DayBookLineKind;
                              updateLine(line.id, {
                                kind,
                                decision:
                                  kind === 'collection'
                                    ? 'needs_order'
                                    : line.decision === 'needs_order'
                                      ? 'skip'
                                      : line.decision,
                                ambiguous: kind === 'collection' || kind === 'unknown',
                              });
                            }}
                          >
                            {(
                              Object.keys(KIND_LABELS) as DayBookLineKind[]
                            ).map((key) => (
                              <option key={key} value={key}>
                                {KIND_LABELS[key]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={line.amount ?? ''}
                            disabled={readOnly}
                            onChange={(e) =>
                              updateLine(line.id, {
                                amount:
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                          <div className="ga-daybook__muted">
                            {line.amount != null
                              ? formatInr(line.amount)
                              : '—'}
                          </div>
                        </td>
                        <td>
                          {line.kind === 'supplier_payment' ? (
                            <select
                              value={line.matchedSupplierId ?? ''}
                              disabled={readOnly}
                              onChange={(e) => {
                                const id = e.target.value || null;
                                const name =
                                  supplierOptions.find((s) => s.id === id)
                                    ?.name ?? null;
                                updateLine(line.id, {
                                  matchedSupplierId: id,
                                  matchedSupplierName: name,
                                  supplierMatchConfidence: id
                                    ? 'exact'
                                    : 'none',
                                  ambiguous: !id,
                                });
                              }}
                            >
                              <option value="">Select supplier</option>
                              {supplierOptions.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          ) : line.kind === 'collection' ? (
                            <div>
                              <select
                                value={line.matchedCustomerId ?? ''}
                                disabled={readOnly}
                                onChange={(e) => {
                                  const id = e.target.value || null;
                                  const name =
                                    customerOptions.find((c) => c.id === id)
                                      ?.shopName ?? null;
                                  updateLine(line.id, {
                                    matchedCustomerId: id,
                                    matchedCustomerName: name,
                                    customerMatchConfidence: id
                                      ? 'exact'
                                      : 'none',
                                    collectHref: id
                                      ? `/customers/${id}`
                                      : null,
                                    decision: 'needs_order',
                                  });
                                }}
                              >
                                <option value="">Select customer</option>
                                {customerOptions.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.shopName}
                                  </option>
                                ))}
                              </select>
                              {line.collectHref ? (
                                <Link to={line.collectHref}>
                                  Open customer
                                </Link>
                              ) : null}
                            </div>
                          ) : (
                            <input
                              value={line.partyHint ?? ''}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateLine(line.id, {
                                  partyHint: e.target.value,
                                })
                              }
                              placeholder="Party hint"
                            />
                          )}
                        </td>
                        <td>
                          <select
                            value={line.decision}
                            disabled={readOnly}
                            onChange={(e) =>
                              updateLine(line.id, {
                                decision: e.target
                                  .value as DayBookLineDecision,
                              })
                            }
                          >
                            <option value="include">Yes — post</option>
                            <option value="skip">No — skip</option>
                            <option value="needs_order">
                              Needs order (collection)
                            </option>
                          </select>
                        </td>
                        <td>
                          {line.ambiguous ? (
                            <span className="ga-daybook__flag">
                              {line.ambiguityReason || 'Ambiguous'}
                            </span>
                          ) : (
                            '—'
                          )}
                          {line.createdExpenseId ? (
                            <div>
                              <Link to={`/expenses/${line.createdExpenseId}`}>
                                Expense created
                              </Link>
                            </div>
                          ) : null}
                          {line.createdSupplierPaymentId ? (
                            <div className="ga-daybook__muted">
                              Supplier payment created
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {error ? <p className="ga-daybook__error">{error}</p> : null}

          {!readOnly ? (
            <div className="ga-daybook__actions">
              <Button
                variant="secondary"
                disabled={
                  saveMutation.isPending ||
                  confirmMutation.isPending ||
                  discardMutation.isPending
                }
                onClick={() => void onSave()}
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
                  ? 'Posting…'
                  : 'Confirm included lines'}
              </Button>
              <Button
                variant="ghost"
                disabled={discardMutation.isPending}
                onClick={() => void onDiscard()}
              >
                Discard
              </Button>
              <Button variant="ghost" onClick={() => navigate('/day-book')}>
                Back
              </Button>
            </div>
          ) : (
            <div className="ga-daybook__actions">
              <Button variant="ghost" onClick={() => navigate('/day-book')}>
                Back to day book
              </Button>
            </div>
          )}
        </div>
      )}
    </QueryStateGate>
  );
}
