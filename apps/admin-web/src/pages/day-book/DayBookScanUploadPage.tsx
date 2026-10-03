import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { usePermissions } from '@groaurum/auth/react';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  useCreateDayBookScanMutation,
  useSaveDayBookScanExtractMutation,
  useUploadDayBookScanImageMutation,
} from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import {
  applyDayBookMatches,
  parseDayBookSourceText,
} from '@/data/day-book-extract';
import { todayExpenseDate } from '@/data/company-expenses';
import { useAdminDataClient } from '@/data/AdminDataProviders';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import './DayBookPage.css';

export function DayBookScanUploadPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('payments:manage');
  const client = useAdminDataClient();
  const createMutation = useCreateDayBookScanMutation();
  const uploadMutation = useUploadDayBookScanImageMutation();
  const saveExtractMutation = useSaveDayBookScanExtractMutation();
  const [sourceText, setSourceText] = useState('');
  const [entryDate, setEntryDate] = useState(todayExpenseDate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return (
      <div className="ga-daybook">
        <PageHeader title="Daily book entry" subtitle="Permission required" />
        <p className="ga-daybook__error">
          You need payments manage permission to enter daily book lines.
        </p>
      </div>
    );
  }

  const buildMatchedExtract = async (text: string) => {
    const base = parseDayBookSourceText(text, { entryDate });
    if (!client.liveApi) return base;
    const [customersSnap, suppliers] = await Promise.all([
      client.liveApi.customersSnapshot(),
      client.liveApi.suppliersList(),
    ]);
    return applyDayBookMatches(
      base,
      (customersSnap.rows ?? []).map((r) => ({
        id: r.id,
        shopName: r.shopName,
        ownerName: r.ownerName,
      })),
      suppliers.map((s) => ({ id: s.id, name: s.name, gstin: s.gstin })),
    );
  };

  const onContinue = async () => {
    const text = sourceText.trim();
    if (!text) {
      setError('Paste at least one daily book line');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const scan = await createMutation.mutateAsync({ sourceText: text });
      const extract = await buildMatchedExtract(text);
      await saveExtractMutation.mutateAsync({
        scanId: scan.id,
        extract,
        sourceText: text,
      });
      navigate(`/day-book/scan/${scan.id}`, { replace: true });
    } catch (err) {
      setError(formatMutationError(err, 'Could not start day book review'));
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const text = sourceText.trim();
      const scan = await createMutation.mutateAsync({
        sourceText: text || null,
      });
      await uploadMutation.mutateAsync({
        scanId: scan.id,
        file: { bytes: file, contentType: file.type || 'image/jpeg' },
      });
      const extract = text
        ? await buildMatchedExtract(text)
        : parseDayBookSourceText('', { entryDate });
      extract.extractorLabel = text ? 'line-rules' : 'manual';
      await saveExtractMutation.mutateAsync({
        scanId: scan.id,
        extract,
        sourceText: text || null,
      });
      navigate(`/day-book/scan/${scan.id}`, { replace: true });
    } catch (err) {
      setError(formatMutationError(err, 'Could not upload day book photo'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ga-daybook">
      <PageHeader
        title="Daily book entry"
        subtitle="Paste handwritten book lines, review matches, then post only what you confirm"
      />
      <SectionRelatedLinks
        label="Accounting"
        links={[...ACCOUNTING_SECTION_LINKS]}
      />

      <section className="ga-daybook__card">
        <h2>Paste lines</h2>
        <p className="ga-daybook__note">
          Parser uses simple line rules (not AI). Example lines:
          <br />
          <code>Cash expense 1200</code>
          <br />
          <code>ABC supplier 15000</code>
          <br />
          <code>Rahul received 8000</code>
        </p>
        <label>
          Entry date
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </label>
        <label>
          Daily book text
          <textarea
            rows={8}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder={'Cash expense 1200\nABC supplier 15000\nRamesh 4500'}
          />
        </label>
        <label className="ga-daybook__upload">
          <span>Optional photo (archive only — type the lines above)</span>
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
        {error ? <p className="ga-daybook__error">{error}</p> : null}
        <div className="ga-daybook__actions">
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void onContinue()}
          >
            {busy ? 'Opening review…' : 'Review lines'}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/day-book')}>
            Back to day book
          </Button>
        </div>
      </section>
    </div>
  );
}
