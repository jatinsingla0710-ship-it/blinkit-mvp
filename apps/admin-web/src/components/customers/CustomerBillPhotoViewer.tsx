import { useEffect, useState } from 'react';
import { Button, Modal } from '@groaurum/ui';
import type { CustomerDocumentVm } from '@/data/customer-documents';
import { formatDate } from '@/data/live/format';
import './CustomerBillPhotos.css';

type Props = {
  document: CustomerDocumentVm | null;
  onClose: () => void;
};

export function CustomerBillPhotoViewer({ document, onClose }: Props) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [document?.id]);

  if (!document) return null;

  return (
    <Modal
      open={Boolean(document)}
      title={document.title?.trim() || 'Bill photo'}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          >
            Zoom out
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
          >
            Zoom in
          </Button>
          <Button variant="primary" type="button" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="ga-cust-bill-viewer">
        <p className="ga-cust-bills__line">
          {[
            document.billNumber ? `Bill #${document.billNumber}` : null,
            document.billDate ? formatDate(document.billDate) : null,
            document.createdAtLabel
              ? `Uploaded ${document.createdAtLabel}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {document.signedUrl ? (
          <div className="ga-cust-bill-viewer__frame">
            <img
              src={document.signedUrl}
              alt={document.title || 'Bill photo'}
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        ) : (
          <p className="ga-cust-bills__muted">No image available.</p>
        )}
      </div>
    </Modal>
  );
}
