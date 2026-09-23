import { useMemo, useRef, useState } from 'react';
import { Button } from '@groaurum/ui';
import type { ProductImageRow } from '@/data/product-types';
import { formatMutationError } from '@/data/mutation-errors';
import {
  useReorderProductImagesMutation,
  useReplaceProductMediaMutation,
  useSoftDeleteProductMediaMutation,
  useUploadProductMediaMutation,
} from '@/data/mutations';
import { Badge } from '@/components/ui/Badge';
import './ProductImageGallery.css';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 4;

type Props = {
  productId: string;
  images: ProductImageRow[];
  canManage?: boolean;
};

export function ProductImageGallery({
  productId,
  images,
  canManage = false,
}: Props) {
  const upload = useUploadProductMediaMutation();
  const replace = useReplaceProductMediaMutation();
  const softDelete = useSoftDeleteProductMediaMutation();
  const reorder = useReorderProductImagesMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const imageRows = useMemo(
    () =>
      images
        .filter((i) => i.mediaKind === 'IMAGE')
        .sort((a, b) => {
          if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
          return a.displayOrder - b.displayOrder;
        }),
    [images],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? imageRows[0]?.id ?? null;
  const activeImage = imageRows.find((i) => i.id === activeId);

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
    if (replaceTargetId) {
      const targetId = replaceTargetId;
      setReplaceTargetId(null);
      void run(() =>
        replace.mutateAsync({
          productId,
          mediaId: targetId,
          file,
          mediaKind: 'IMAGE',
        }),
      );
      return;
    }
    void run(async () => {
      const result = await upload.mutateAsync({
        productId,
        file,
        mediaKind: 'IMAGE',
      });
      setSelectedId(result.id);
    });
  };

  const setAsCover = (imageId: string) => {
    const ids = imageRows.map((i) => i.id);
    const idx = ids.indexOf(imageId);
    if (idx <= 0) return;
    const next = [imageId, ...ids.filter((id) => id !== imageId)];
    void run(() => reorder.mutateAsync({ productId, imageIds: next }));
  };

  const removeImage = (imageId: string) => {
    void run(async () => {
      await softDelete.mutateAsync(imageId);
      if (activeId === imageId) {
        setSelectedId(null);
      }
    });
  };

  return (
    <section className="ga-product-gallery" aria-label="Product images">
      <div className="ga-product-gallery__main">
        {activeImage ? (
          <img
            src={activeImage.url}
            alt={activeImage.altLabel}
            className="ga-product-gallery__hero"
          />
        ) : (
          <div className="ga-product-gallery__placeholder">
            <span>No product image</span>
          </div>
        )}
        {activeImage?.isPrimary || activeImage?.id === imageRows[0]?.id ? (
          <span className="ga-product-gallery__cover-badge">
            <Badge tone="success">Cover</Badge>
          </span>
        ) : null}
      </div>

      {imageRows.length > 0 ? (
        <div className="ga-product-gallery__thumbs" role="list">
          {imageRows.map((image) => (
            <button
              key={image.id}
              type="button"
              role="listitem"
              className={`ga-product-gallery__thumb${
                image.id === activeId ? ' is-active' : ''
              }`}
              onClick={() => setSelectedId(image.id)}
              aria-label={`View image ${image.displayOrder + 1}`}
            >
              <img src={image.url} alt="" />
            </button>
          ))}
          {canManage && imageRows.length < MAX_IMAGES ? (
            <button
              type="button"
              className="ga-product-gallery__thumb ga-product-gallery__thumb--add"
              onClick={() => {
                setReplaceTargetId(null);
                fileInputRef.current?.click();
              }}
              disabled={busy}
              aria-label="Add image"
            >
              +
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="ga-product-gallery__error" role="alert">
          {error}
        </p>
      ) : null}

      {canManage ? (
        <div className="ga-product-gallery__actions">
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
          {!activeImage && imageRows.length < MAX_IMAGES ? (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              + Add Product Image
            </Button>
          ) : null}
          {activeImage ? (
            <>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setReplaceTargetId(activeImage.id);
                  fileInputRef.current?.click();
                }}
              >
                Change Image
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => removeImage(activeImage.id)}
              >
                Remove
              </Button>
              {activeImage.id !== imageRows[0]?.id ? (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setAsCover(activeImage.id)}
                >
                  Set as Cover
                </Button>
              ) : null}
            </>
          ) : null}
          <span className="ga-product-gallery__count">
            {imageRows.length}/{MAX_IMAGES} images
          </span>
        </div>
      ) : null}
    </section>
  );
}
