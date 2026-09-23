import { useRef, useState } from 'react';
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
import { EmptyState } from '@/components/ui/EmptyState';
import './ProductImagesTab.css';

type Props = {
  productId: string;
  images: ProductImageRow[];
  canManage?: boolean;
};

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';

/**
 * Product media — up to 4 square images + 1 video via Supabase Storage.
 * Cover = first image (is_primary). Existing products with no media remain valid.
 */
export function ProductImagesTab({
  productId,
  images,
  canManage = false,
}: Props) {
  const upload = useUploadProductMediaMutation();
  const replace = useReplaceProductMediaMutation();
  const softDelete = useSoftDeleteProductMediaMutation();
  const reorder = useReorderProductImagesMutation();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<ProductImageRow | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const imageRows = images.filter((i) => i.mediaKind === 'IMAGE');
  const videoRow = images.find((i) => i.mediaKind === 'VIDEO') ?? null;

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(formatMutationError(err, 'Media action failed'));
    } finally {
      setBusy(false);
    }
  };

  const onUploadImage = (file: File | undefined) => {
    if (!file) return;
    void run(() =>
      upload.mutateAsync({
        productId,
        file,
        mediaKind: 'IMAGE',
      }),
    );
  };

  const onUploadVideo = (file: File | undefined) => {
    if (!file) return;
    void run(async () => {
      if (videoRow) {
        await replace.mutateAsync({
          productId,
          mediaId: videoRow.id,
          file,
          mediaKind: 'VIDEO',
        });
      } else {
        await upload.mutateAsync({
          productId,
          file,
          mediaKind: 'VIDEO',
        });
      }
    });
  };

  const onReplace = (file: File | undefined) => {
    if (!file || !replaceTarget) return;
    const target = replaceTarget;
    setReplaceTarget(null);
    void run(() =>
      replace.mutateAsync({
        productId,
        mediaId: target.id,
        file,
        mediaKind: target.mediaKind,
      }),
    );
  };

  const moveImage = (id: string, dir: -1 | 1) => {
    const ids = imageRows.map((i) => i.id);
    const idx = ids.indexOf(id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= ids.length) return;
    const next = [...ids];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    void run(() => reorder.mutateAsync({ productId, imageIds: next }));
  };

  return (
    <div className="ga-images-tab">
      <p className="ga-images-tab__hint">
        Up to 4 square images and 1 video. The first image is the cover used in
        product lists and catalogue. Files are stored in Supabase Storage — not
        in the database.
      </p>

      {error ? (
        <p className="ga-images-tab__error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="ga-images-tab__section">
        <div className="ga-images-tab__section-head">
          <h3>Images ({imageRows.length}/4)</h3>
          {canManage && imageRows.length < 4 ? (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                hidden
                onChange={(e) => {
                  onUploadImage(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => imageInputRef.current?.click()}
              >
                Upload image
              </Button>
            </>
          ) : null}
        </div>

        {imageRows.length === 0 ? (
          <EmptyState
            title="No images"
            detail="Optional — publishing does not require an image."
          />
        ) : (
          <div className="ga-images-tab__grid">
            {imageRows.map((image, index) => (
              <article key={image.id} className="ga-images-tab__card">
                <div className="ga-images-tab__frame">
                  <img src={image.url || image.urlLabel} alt={image.altLabel} />
                </div>
                <div className="ga-images-tab__meta">
                  <Badge tone={image.isPrimary || index === 0 ? 'success' : 'neutral'}>
                    {image.isPrimary || index === 0 ? 'Cover' : `Image ${index + 1}`}
                  </Badge>
                </div>
                {canManage ? (
                  <div className="ga-images-tab__actions">
                    <Button
                      variant="ghost"
                      disabled={busy || index === 0}
                      onClick={() => moveImage(image.id, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy || index === imageRows.length - 1}
                      onClick={() => moveImage(image.id, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setReplaceTarget(image);
                        replaceInputRef.current?.click();
                      }}
                    >
                      Replace
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy || softDelete.isPending}
                      onClick={() =>
                        void run(() => softDelete.mutateAsync(image.id))
                      }
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="ga-images-tab__section">
        <div className="ga-images-tab__section-head">
          <h3>Video ({videoRow ? 1 : 0}/1)</h3>
          {canManage ? (
            <>
              <input
                ref={videoInputRef}
                type="file"
                accept={VIDEO_ACCEPT}
                hidden
                onChange={(e) => {
                  onUploadVideo(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => videoInputRef.current?.click()}
              >
                {videoRow ? 'Replace video' : 'Upload video'}
              </Button>
            </>
          ) : null}
        </div>

        {videoRow ? (
          <div className="ga-images-tab__video">
            <video
              controls
              src={videoRow.url || videoRow.urlLabel}
              className="ga-images-tab__video-el"
            />
            {canManage ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void run(() => softDelete.mutateAsync(videoRow.id))
                }
              >
                Delete video
              </Button>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="No video"
            detail="Optional product video (MP4 / WebM)."
          />
        )}
      </section>

      <input
        ref={replaceInputRef}
        type="file"
        accept={
          replaceTarget?.mediaKind === 'VIDEO' ? VIDEO_ACCEPT : IMAGE_ACCEPT
        }
        hidden
        onChange={(e) => {
          onReplace(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
