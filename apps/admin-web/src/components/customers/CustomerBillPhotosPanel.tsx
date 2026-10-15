import { useState } from 'react';
import { Button } from '@groaurum/ui';
import type { CustomerDocumentVm } from '@/data/customer-documents';
import { formatDate } from '@/data/live/format';
import { formatMutationError } from '@/data/mutation-errors';
import { useSoftDeleteCustomerDocumentMutation } from '@/data/mutations';
import { EmptyState } from '@/components/ui/EmptyState';
import { CustomerBillPhotoViewer } from '@/components/customers/CustomerBillPhotoViewer';
import './CustomerBillPhotos.css';

type Props = {
  shopId: string;
  documents: CustomerDocumentVm[];
  loading?: boolean;
  canManage: boolean;
  onAdd: () => void;
};

export function CustomerBillPhotosPanel({
  shopId,
  documents,
  loading,
  canManage,
  onAdd,
}: Props) {
  const softDelete = useSoftDeleteCustomerDocumentMutation();
  const [viewer, setViewer] = useState<CustomerDocumentVm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async (doc: CustomerDocumentVm) => {
    const ok = window.confirm(
      'Remove this bill photo from the customer? The record will be archived (soft-deleted).',
    );
    if (!ok) return;
    setError(null);
    try {
      await softDelete.mutateAsync({ shopId, documentId: doc.id });
      if (viewer?.id === doc.id) setViewer(null);
    } catch (err) {
      setError(formatMutationError(err, 'Could not remove bill photo'));
    }
  };

  if (loading) {
    return <p className="ga-cust-bills__muted">Loading bills…</p>;
  }

  return (
    <div className="ga-cust-bills">
      <div className="ga-cust-bills__toolbar">
        {canManage ? (
          <Button variant="primary" type="button" onClick={onAdd}>
            + Add bill photo
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="ga-cust-form__error" role="alert">
          {error}
        </p>
      ) : null}

      {documents.length === 0 ? (
        <>
          <EmptyState
            title="No bills or documents added yet."
            detail="Save a photo of a paper bill or invoice for this customer."
          />
          {canManage ? (
            <div className="ga-cust-bills__toolbar">
              <Button variant="primary" type="button" onClick={onAdd}>
                + Add bill photo
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <ul className="ga-cust-bills__grid">
          {documents.map((doc) => (
            <li key={doc.id} className="ga-cust-bills__card">
              <button
                type="button"
                className="ga-cust-bills__thumb"
                onClick={() => setViewer(doc)}
              >
                {doc.signedUrl ? (
                  <img
                    src={doc.signedUrl}
                    alt={doc.title || 'Bill photo'}
                    loading="lazy"
                  />
                ) : (
                  <span className="ga-cust-bills__placeholder">No image</span>
                )}
              </button>
              <div className="ga-cust-bills__meta">
                <p className="ga-cust-bills__title">
                  {doc.title?.trim() || 'Bill photo'}
                </p>
                {doc.billNumber ? (
                  <p className="ga-cust-bills__line">Bill #{doc.billNumber}</p>
                ) : null}
                <p className="ga-cust-bills__line">
                  {doc.billDate
                    ? `Bill date ${formatDate(doc.billDate)}`
                    : `Uploaded ${doc.createdAtLabel}`}
                </p>
                <div className="ga-cust-bills__row-actions">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setViewer(doc)}
                  >
                    View
                  </Button>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => void onDelete(doc)}
                      disabled={softDelete.isPending}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CustomerBillPhotoViewer
        document={viewer}
        onClose={() => setViewer(null)}
      />
    </div>
  );
}
