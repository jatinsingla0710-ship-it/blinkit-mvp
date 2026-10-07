import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  useCreatePurchaseBillScanMutation,
  useSavePurchaseBillScanExtractMutation,
  useUploadPurchaseBillScanImageMutation,
} from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import { runManualBillExtractor } from '@/data/bill-extract';
import { PURCHASING_SECTION_LINKS } from '@/data/purchasing';
import { scanImageInputAttrs } from '@/data/ux-performance';
import './PurchasingPages.css';

export function BillScanUploadPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const createMutation = useCreatePurchaseBillScanMutation();
  const uploadMutation = useUploadPurchaseBillScanImageMutation();
  const saveExtractMutation = useSavePurchaseBillScanExtractMutation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return (
      <div className="ga-purchasing">
        <PageHeader title="Bill photo" subtitle="Permission required" />
        <p className="ga-purchasing__error">
          You need payments manage permission to upload bill photos.
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
      const extract = await runManualBillExtractor({ imageFileName: file.name });
      await saveExtractMutation.mutateAsync({
        scanId: scan.id,
        extract,
      });
      navigate(`/purchases/scan/${scan.id}`, { replace: true });
    } catch (err) {
      setError(formatMutationError(err, 'Could not upload bill photo'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ga-purchasing">
      <PageHeader
        title="Bill photo"
        subtitle="Upload a supplier bill photo, review the fields, then create a purchase draft"
      />
      <SectionRelatedLinks
        label="Purchasing"
        links={[...PURCHASING_SECTION_LINKS]}
      />

      <section className="ga-purchasing__card">
        <h2>Upload</h2>
        <p className="ga-purchasing__note">
          Photos are stored for review. Extraction starts as{' '}
          <strong>manual</strong> entry — nothing is auto-received into stock.
          Confirm only creates a purchase draft.
        </p>
        <label className="ga-purchasing__upload">
          <span>Bill photo (JPEG, PNG, or WebP)</span>
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
          <p className="ga-purchasing__muted">Uploading and opening review…</p>
        ) : null}
        {error ? <p className="ga-purchasing__error">{error}</p> : null}
        <div className="ga-purchasing__actions">
          <Button variant="ghost" onClick={() => navigate('/purchases')}>
            Back to purchases
          </Button>
        </div>
      </section>
    </div>
  );
}
