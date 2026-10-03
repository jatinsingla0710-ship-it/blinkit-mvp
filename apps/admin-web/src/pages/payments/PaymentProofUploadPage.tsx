import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  useCreatePaymentProofScanMutation,
  useSavePaymentProofScanExtractMutation,
  useUploadPaymentProofScanImageMutation,
} from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import { runManualPaymentProofExtractor } from '@/data/payment-proof-extract';
import { SALES_SECTION_LINKS } from '@/data/section-links';
import './PaymentsPage.css';

export function PaymentProofUploadPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const createMutation = useCreatePaymentProofScanMutation();
  const uploadMutation = useUploadPaymentProofScanImageMutation();
  const saveExtractMutation = useSavePaymentProofScanExtractMutation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return (
      <div className="ga-payments">
        <PageHeader title="Payment proof" subtitle="Permission required" />
        <p className="ga-payments__error">
          You need payments manage permission to upload payment proofs.
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
      const extract = await runManualPaymentProofExtractor({
        imageFileName: file.name,
      });
      await saveExtractMutation.mutateAsync({
        scanId: scan.id,
        extract,
      });
      navigate(`/payments/scan/${scan.id}`, { replace: true });
    } catch (err) {
      setError(formatMutationError(err, 'Could not upload payment proof'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ga-payments">
      <PageHeader
        title="Payment proof"
        subtitle="Upload a UPI/bank screenshot, review the fields, then mark an order paid"
      />
      <SectionRelatedLinks label="Sales" links={[...SALES_SECTION_LINKS]} />

      <section className="ga-payments__card">
        <h2>Upload</h2>
        <p className="ga-payments__note">
          Extraction starts as <strong>manual</strong> entry. Nothing is marked
          paid from the photo alone — you must choose the unpaid order and
          confirm.
        </p>
        <label className="ga-payments__upload">
          <span>Payment screenshot (JPEG, PNG, or WebP)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void onPickFile(file);
              e.target.value = '';
            }}
          />
        </label>
        {busy ? (
          <p className="ga-payments__muted">Uploading and opening review…</p>
        ) : null}
        {error ? <p className="ga-payments__error">{error}</p> : null}
        <div className="ga-payments__actions">
          <Button variant="ghost" onClick={() => navigate('/payments')}>
            Back to collections
          </Button>
        </div>
      </section>
    </div>
  );
}
