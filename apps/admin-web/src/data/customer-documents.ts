/**
 * Phase 4B — Customer private documents / bill photos (API view-models).
 * UI wiring is Phase 4D; OCR is not implemented.
 */

export type CustomerDocumentType = 'BILL_PHOTO' | 'GST' | 'OTHER';

export type CustomerDocumentOcrStatus = 'NONE' | 'PENDING' | 'DONE' | 'FAILED';

export type CustomerDocumentVm = {
  id: string;
  shopId: string;
  documentType: CustomerDocumentType;
  storagePath: string | null;
  mimeType: string | null;
  byteSize: number | null;
  title: string | null;
  notes: string | null;
  billDate: string | null;
  billNumber: string | null;
  ocrStatus: CustomerDocumentOcrStatus;
  uploadedByProfileId: string | null;
  createdAt: string;
  createdAtLabel: string;
  /** 1-hour signed URL; null when no image attached yet. */
  signedUrl: string | null;
};

export const CUSTOMER_DOCUMENT_BUCKET = 'customer-documents' as const;

export const CUSTOMER_DOCUMENT_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const CUSTOMER_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export function customerDocumentStoragePath(
  documentId: string,
  contentType: string,
): string {
  const ext =
    contentType === 'image/png'
      ? 'png'
      : contentType === 'image/webp'
        ? 'webp'
        : 'jpg';
  return `${documentId}/bill.${ext}`;
}
