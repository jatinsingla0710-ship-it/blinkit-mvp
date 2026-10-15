import { useEffect, useRef, useState } from 'react';
import { Modal, TextField, Button } from '@groaurum/ui';
import {
  CUSTOMER_DOCUMENT_ALLOWED_MIME,
  CUSTOMER_DOCUMENT_MAX_BYTES,
} from '@/data/customer-documents';
import { formatMutationError } from '@/data/mutation-errors';
import {
  useCreateCustomerDocumentMutation,
  useUploadCustomerDocumentImageMutation,
} from '@/data/mutations';
import { scanImageInputAttrs } from '@/data/ux-performance';
import './CustomerFormModal.css';
import './CustomerBillPhotos.css';

type Props = {
  open: boolean;
  onClose: () => void;
  shopId: string;
  onUploaded?: () => void;
};

export function CustomerAddBillPhotoModal({
  open,
  onClose,
  shopId,
  onUploaded,
}: Props) {
  const createDoc = useCreateCustomerDocumentMutation();
  const uploadDoc = useUploadCustomerDocumentImageMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [billDate, setBillDate] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setPreviewUrl(null);
    setTitle('');
    setNotes('');
    setBillDate('');
    setBillNumber('');
    setError(null);
    setBusy(false);
    setDone(false);
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pickFile = (next: File | null) => {
    if (!next) return;
    const mime = next.type || 'image/jpeg';
    if (
      !(CUSTOMER_DOCUMENT_ALLOWED_MIME as readonly string[]).includes(mime)
    ) {
      setError('Use a JPEG, PNG, or WebP photo.');
      return;
    }
    if (next.size > CUSTOMER_DOCUMENT_MAX_BYTES) {
      setError('Photo must be 10 MB or smaller.');
      return;
    }
    setError(null);
    setFile(next);
  };

  const onUpload = async () => {
    if (!file) {
      setError('Choose a photo first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createDoc.mutateAsync({
        shopId,
        documentType: 'BILL_PHOTO',
        title: title.trim() || null,
        notes: notes.trim() || null,
        billDate: billDate || null,
        billNumber: billNumber.trim() || null,
      });
      await uploadDoc.mutateAsync({
        shopId,
        documentId: created.id,
        file: {
          bytes: file,
          contentType: file.type || 'image/jpeg',
        },
      });
      setDone(true);
      onUploaded?.();
    } catch (err) {
      setError(formatMutationError(err, 'Could not upload bill photo'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Add bill photo"
      onClose={onClose}
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void onUpload()}
              disabled={busy || !file}
            >
              {busy ? 'Uploading…' : 'Upload'}
            </Button>
          </>
        )
      }
    >
      <div className="ga-cust-form ga-cust-bill-upload">
        {done ? (
          <p className="ga-cust-form__success" role="status">
            Bill photo saved. It now appears under Bills & Photos.
          </p>
        ) : (
          <>
            <p className="ga-cust-form__hint">
              Take a photo or choose from your gallery. JPEG, PNG, or WebP — max
              10 MB.
            </p>

            <div className="ga-cust-bill-upload__actions">
              <Button
                variant="secondary"
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {file ? 'Change photo' : 'Take photo / choose file'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                className="ga-cust-bill-upload__input"
                {...scanImageInputAttrs()}
                disabled={busy}
                onChange={(e) => {
                  pickFile(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
            </div>

            {previewUrl ? (
              <div className="ga-cust-bill-upload__preview">
                <img src={previewUrl} alt="Selected bill preview" />
              </div>
            ) : null}

            <TextField
              label="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <TextField
              label="Bill date (optional)"
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
            />
            <TextField
              label="Bill number (optional)"
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
            />
            <TextField
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {error ? (
              <p className="ga-cust-form__error" role="alert">
                {error}
              </p>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
