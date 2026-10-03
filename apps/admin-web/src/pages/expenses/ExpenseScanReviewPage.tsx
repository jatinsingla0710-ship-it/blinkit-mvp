import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useExpenseReceiptScanQuery } from '@/data/hooks';
import {
  useConfirmExpenseReceiptScanMutation,
  useDiscardExpenseReceiptScanMutation,
  useSaveExpenseReceiptScanExtractMutation,
} from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import {
  applyReceiptExtractMatches,
  emptyReceiptExtract,
  type ReceiptExtractDraft,
} from '@/data/receipt-extract';
import {
  COMPANY_EXPENSE_CATEGORIES,
  COMPANY_EXPENSE_CATEGORY_LABELS,
  COMPANY_EXPENSE_PAYMENT_METHODS,
  COMPANY_EXPENSE_PAYMENT_METHOD_LABELS,
  todayExpenseDate,
  type CompanyExpenseCategory,
  type CompanyExpensePaymentMethod,
} from '@/data/company-expenses';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import './ExpensesPage.css';

export function ExpenseScanReviewPage() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const scanQuery = useExpenseReceiptScanQuery(scanId);

  const saveMutation = useSaveExpenseReceiptScanExtractMutation();
  const confirmMutation = useConfirmExpenseReceiptScanMutation();
  const discardMutation = useDiscardExpenseReceiptScanMutation();

  const [extract, setExtract] = useState<ReceiptExtractDraft>(
    emptyReceiptExtract(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanQuery.data || hydrated) return;
    setExtract(scanQuery.data.extract);
    setHydrated(true);
  }, [scanQuery.data, hydrated]);

  const readOnly =
    scanQuery.data?.status === 'CONFIRMED' ||
    scanQuery.data?.status === 'DISCARDED';

  const rematch = () => {
    setExtract((prev) => applyReceiptExtractMatches(prev));
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
      const saved = await saveMutation.mutateAsync({ scanId, extract });
      const imagePath = saved.imagePath;
      const result = await confirmMutation.mutateAsync({
        scanId: saved.id,
        expense: {
          expenseDate: (extract.expenseDate || todayExpenseDate()).slice(0, 10),
          category: extract.category ?? 'OTHER',
          amount: Number(extract.amount ?? 0),
          description:
            extract.description?.trim() ||
            extract.merchantHint?.trim() ||
            `From receipt photo (${extract.extractorLabel})`,
          paymentMethod: extract.paymentMethod ?? 'CASH',
          referenceNumber: extract.referenceNumber?.trim() || null,
          receiptPath: imagePath,
        },
      });
      navigate(`/expenses/${result.expense.id}`);
    } catch (err) {
      setError(formatMutationError(err, 'Could not create expense'));
    }
  };

  const onDiscard = async () => {
    if (!scanId) return;
    setError(null);
    try {
      await discardMutation.mutateAsync(scanId);
      navigate('/expenses');
    } catch (err) {
      setError(formatMutationError(err, 'Could not discard scan'));
    }
  };

  if (!canManage) {
    return (
      <div className="ga-expenses">
        <PageHeader title="Review receipt" subtitle="Permission required" />
        <p className="ga-expenses__error">
          You need payments manage permission to review receipt photos.
        </p>
      </div>
    );
  }

  return (
    <QueryStateGate
      title="Review receipt"
      state={scanQuery.state}
      emptyTitle="Receipt scan not found"
      emptyDetail="This scan may have been discarded or the link is wrong."
    >
      {(scan) => (
        <div className="ga-expenses">
          <PageHeader
            title="Review receipt"
            subtitle={`Extractor: ${scan.extractorLabel} · Status: ${scan.status}`}
            meta={scan.createdAtLabel}
            actions={
              scan.expenseId ? (
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/expenses/${scan.expenseId}`)}
                >
                  Open expense
                </Button>
              ) : undefined
            }
          />
          <SectionRelatedLinks
            label="Accounting"
            links={[...ACCOUNTING_SECTION_LINKS]}
          />

          <section className="ga-expenses__card ga-expenses__scan-layout">
            <div>
              <h2>Photo</h2>
              {scan.imageUrl ? (
                <img
                  className="ga-expenses__receipt-image"
                  src={scan.imageUrl}
                  alt="Uploaded expense receipt"
                />
              ) : (
                <p className="ga-expenses__note">No photo attached.</p>
              )}
              <p className="ga-expenses__muted">
                Manual review required. Confirm creates a company expense —
                it will appear in Day Book. Nothing is posted from the photo
                alone.
              </p>
            </div>

            <div>
              <div className="ga-expenses__card-head">
                <h2>Receipt fields</h2>
                {!readOnly ? (
                  <Button variant="ghost" onClick={rematch}>
                    Re-match category / payment
                  </Button>
                ) : null}
              </div>

              <div className="ga-expenses__form-grid">
                <label>
                  Merchant hint
                  <input
                    value={extract.merchantHint ?? ''}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        merchantHint: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Category hint
                  <input
                    value={extract.categoryHint ?? ''}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        categoryHint: e.target.value,
                      }))
                    }
                    placeholder="e.g. petrol, rent"
                  />
                </label>
                <label>
                  Category
                  <select
                    value={extract.category ?? 'OTHER'}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        category: e.target.value as CompanyExpenseCategory,
                        categoryMatchConfidence: 'exact',
                      }))
                    }
                  >
                    {COMPANY_EXPENSE_CATEGORIES.map((key) => (
                      <option key={key} value={key}>
                        {COMPANY_EXPENSE_CATEGORY_LABELS[key]}
                        {extract.category === key &&
                        extract.categoryMatchConfidence &&
                        extract.categoryMatchConfidence !== 'none'
                          ? ` (${extract.categoryMatchConfidence})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Amount
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={extract.amount ?? ''}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        amount:
                          e.target.value === ''
                            ? null
                            : Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Expense date
                  <input
                    type="date"
                    value={extract.expenseDate ?? todayExpenseDate()}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        expenseDate: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Payment method
                  <select
                    value={extract.paymentMethod ?? 'CASH'}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        paymentMethod: e.target
                          .value as CompanyExpensePaymentMethod,
                      }))
                    }
                  >
                    {COMPANY_EXPENSE_PAYMENT_METHODS.map((key) => (
                      <option key={key} value={key}>
                        {COMPANY_EXPENSE_PAYMENT_METHOD_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reference
                  <input
                    value={extract.referenceNumber ?? ''}
                    disabled={readOnly}
                    onChange={(e) =>
                      setExtract((prev) => ({
                        ...prev,
                        referenceNumber: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label>
                Description
                <textarea
                  rows={2}
                  value={extract.description ?? ''}
                  disabled={readOnly}
                  onChange={(e) =>
                    setExtract((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </label>
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

          {error ? <p className="ga-expenses__error">{error}</p> : null}

          {!readOnly ? (
            <div className="ga-expenses__actions">
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
                  ? 'Creating expense…'
                  : 'Confirm → create expense'}
              </Button>
              <Button
                variant="ghost"
                disabled={discardMutation.isPending}
                onClick={() => void onDiscard()}
              >
                Discard
              </Button>
              <Button variant="ghost" onClick={() => navigate('/expenses')}>
                Back
              </Button>
            </div>
          ) : (
            <div className="ga-expenses__actions">
              {scan.expenseId ? (
                <Link to={`/expenses/${scan.expenseId}`}>Open linked expense</Link>
              ) : null}
              <Button variant="ghost" onClick={() => navigate('/expenses')}>
                Back to expenses
              </Button>
            </div>
          )}
        </div>
      )}
    </QueryStateGate>
  );
}
