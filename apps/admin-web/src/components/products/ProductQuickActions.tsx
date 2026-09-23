import type { ProductPublishStatus } from '@/data/product-types';
import { ActionBar, Button } from '@groaurum/ui';
import './ProductWorkflowNextSteps.css';

export type ProductQuickActionId =
  | 'add_product'
  | 'duplicate_product'
  | 'archive'
  | 'delete'
  | 'publish'
  | 'unpublish'
  | 'edit';

type Props = {
  publishStatus: ProductPublishStatus;
  canPublish: boolean;
  missingRequiredLabels?: string[];
  onAction?: (id: ProductQuickActionId) => void;
  compact?: boolean;
  /** List page: only Add Product. Detail: full toolbar. */
  variant?: 'list' | 'detail';
  /** When false, mutation actions are hidden (products:manage). */
  canManage?: boolean;
  publishPending?: boolean;
};

export function ProductQuickActions({
  publishStatus,
  canPublish,
  missingRequiredLabels = [],
  onAction,
  compact = false,
  variant = 'detail',
  canManage = false,
  publishPending = false,
}: Props) {
  const archived = publishStatus === 'archived';
  const published = publishStatus === 'published';
  const draft = publishStatus === 'draft';

  if (!canManage && variant === 'list') {
    return null;
  }

  const publishDisabledReason = archived
    ? 'Product is archived'
    : published
      ? 'Already published'
      : !canPublish
        ? missingRequiredLabels.length > 0
          ? `Cannot publish yet: ${missingRequiredLabels.join(', ')}`
          : 'Complete required catalogue fields first'
        : undefined;

  return (
    <ActionBar className={compact ? 'ga-action-bar--compact' : undefined}>
      {canManage ? (
        <Button variant="secondary" onClick={() => onAction?.('add_product')}>
          Add Product
        </Button>
      ) : null}
      {variant === 'detail' && canManage ? (
        <>
          <Button
            variant="secondary"
            onClick={() => onAction?.('edit')}
            disabled={archived}
          >
            Edit Product
          </Button>
          <Button
            variant="secondary"
            onClick={() => onAction?.('delete')}
            disabled={archived}
            title={
              archived
                ? 'Product is already deleted'
                : 'Soft-delete product (Admin only). Historical orders/sales remain.'
            }
          >
            Delete Product
          </Button>
          {published ? (
            <>
              <span className="ga-product-published-mark" aria-live="polite">
                ✓ Published
              </span>
              <Button
                variant="secondary"
                onClick={() => onAction?.('unpublish')}
                disabled={publishPending}
                title="Hide from customer catalogue (returns to Draft)"
              >
                Unpublish
              </Button>
            </>
          ) : draft ? (
            <Button
              variant="primary"
              onClick={() => onAction?.('publish')}
              disabled={!canPublish || publishPending}
              title={publishDisabledReason}
            >
              Publish Product
            </Button>
          ) : null}
          {draft && !canPublish && missingRequiredLabels.length > 0 ? (
            <span className="ga-product-publish-hint" title={publishDisabledReason}>
              Missing: {missingRequiredLabels.join(', ')}
            </span>
          ) : null}
        </>
      ) : null}
    </ActionBar>
  );
}
