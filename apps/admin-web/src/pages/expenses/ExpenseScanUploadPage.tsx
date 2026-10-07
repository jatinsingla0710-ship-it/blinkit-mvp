import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  useCreateExpenseReceiptScanMutation,
  useSaveExpenseReceiptScanExtractMutation,
  useUploadExpenseReceiptScanImageMutation,
} from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import { runManualReceiptExtractor } from '@/data/receipt-extract';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import { scanImageInputAttrs } from '@/data/ux-performance';
import './ExpensesPage.css';

export function ExpenseScanUploadPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const createMutation = useCreateExpenseReceiptScanMutation();
  const uploadMutation = useUploadExpenseReceiptScanImageMutation();
  const saveExtractMutation = useSaveExpenseReceiptScanExtractMutation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return (
      <div className="ga-expenses">
        <PageHeader title="Receipt photo" subtitle="Permission required" />
        <p className="ga-expenses__error">
          You need payments manage permission to upload receipt photos.
        </p>
      </div>
    );
  }

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const scan = await createMutation.mutateAsync(null);
      await uploadMutation.mutateAsync({
        scanId: scan.id,
        file: { bytes: file, contentType: file.type || 'image/jpeg' },
      });
      const extract = await runManualReceiptExtractor({
        imageFileName: file.name,
      });
      await saveExtractMutation.mutateAsync({
        scanId: scan.id,
        extract,
      });
      navigate(`/expenses/scan/${scan.id}`, { replace: true });
    } catch (err) {
      setError(formatMutationError(err, 'Could not upload receipt photo'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ga-expenses">
      <PageHeader
        title="Receipt photo"
        subtitle="Upload an expense receipt, review the fields, then create the expense"
      />
      <SectionRelatedLinks
        label="Accounting"
        links={[...ACCOUNTING_SECTION_LINKS]}
      />

      <section className="ga-expenses__card">
        <h2>Upload</h2>
        <p className="ga-expenses__note">
          Photos are stored for review. Extraction starts as{' '}
          <strong>manual</strong> entry — nothing is posted silently. Confirm
          creates a company expense and updates Day Book.
        </p>
        <label className="ga-expenses__upload">
          <span>Receipt photo (JPEG, PNG, or WebP)</span>
          <input
            type="file"
            {...scanImageInputAttrs()}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void onPickFile(file);
              e.target.value = '';
            }}
          />
        </label>
        {busy ? (
          <p className="ga-expenses__muted">Uploading and opening review…</p>
        ) : null}
        {error ? <p className="ga-expenses__error">{error}</p> : null}
        <div className="ga-expenses__actions">
          <Button variant="ghost" onClick={() => navigate('/expenses')}>
            Back to expenses
          </Button>
        </div>
      </section>
    </div>
  );
}
