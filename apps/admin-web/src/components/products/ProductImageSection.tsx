import { useRef, useState } from 'react';
import { Button } from '@groaurum/ui';
import type { ProductImageRow } from '@/data/product-types';
import { formatMutationError } from '@/data/mutation-errors';
import {
  useReplaceProductMediaMutation,
  useSoftDeleteProductMediaMutation,
  useUploadProductMediaMutation,
} from '@/data/mutations';
import './ProductImageSection.css';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  productId: string;
  images: ProductImageRow[];
  canManage?: boolean;
};

/**
 * Compact product image block for the detail page header area.
 */
export function ProductImageSection({
  productId,
  images,
  canManage = false,
}: Props) {
  const upload = useUploadProductMediaMutation();
  const replace = useReplaceProductMediaMutation();
  const softDelete = useSoftDeleteProductMediaMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<ProductImageRow | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cover =
    images.find((i) => i.mediaKind === 'IMAGE' && i.isPrimary) ??
    images.find((i) => i.mediaKind === 'IMAGE');

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(formatMutationError(err, 'Image action failed'));
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError('Image must be 5 MB or smaller');
      return;
    }
    if (replaceTarget) {
      const target = replaceTarget;
      setReplaceTarget(null);
      void run(() =>
        replace.mutateAsync({
          productId,
          mediaId: target.id,
          file,
          mediaKind: 'IMAGE',
        }),
      );
      return;
    }
    void run(() =>
      upload.mutateAsync({ productId, file, mediaKind: 'IMAGE' }),
    );
  };

  return (
    <section className="ga-product-image-section" aria-label="Product image">
      <div className="ga-product-image-section__frame">
        {cover ? (
          <img src={cover.url} alt={cover.altLabel} />
        ) : (
          <div className="ga-product-image-section__placeholder">
            <span>Product Image</span>
          </div>
        )}
      </div>

      {error ? (
        <p className="ga-product-image-section__error" role="alert">
          {error}
        </p>
      ) : null}

      {canManage ? (
        <div className="ga-product-image-section__actions">
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            hidden
            onChange={(e) => {
              onPickFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {cover ? (
            <>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setReplaceTarget(cover);
                  fileInputRef.current?.click();
                }}
              >
                Change Image
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void run(() => softDelete.mutateAsync(cover.id))}
              >
                Remove Image
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              + Add Product Image
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
