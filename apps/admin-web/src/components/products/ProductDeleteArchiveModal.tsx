import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal } from '@groaurum/ui';
import { formatMutationError } from '@/data/mutation-errors';
import { useProductDeletionInfoQuery } from '@/data/hooks';
import {
  useSoftDeleteProductMutation,
  useUpdateProductMutation,
} from '@/data/mutations';
import './ProductDeleteArchiveModal.css';

type Props = {
  open: boolean;
  productId: string;
  productName: string;
  onClose: () => void;
};

export function ProductDeleteArchiveModal({
  open,
  productId,
  productName,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const infoQuery = useProductDeletionInfoQuery(productId, open);
  const archiveProduct = useUpdateProductMutation();
  const deleteProduct = useSoftDeleteProductMutation();

  useEffect(() => {
    if (open) void infoQuery.refetch();
  }, [open, productId]);

  const pending = archiveProduct.isPending || deleteProduct.isPending;
  const info = infoQuery.data;
  const hasHistory =
    (info?.orderLineCount ?? 0) > 0 || (info?.movementCount ?? 0) > 0;

  const onArchive = () => {
    archiveProduct.mutate(
      { id: productId, input: { isActive: false } },
      {
        onSuccess: () => {
          onClose();
          navigate('/products');
        },
      },
    );
  };

  const onDelete = () => {
    deleteProduct.mutate(productId, {
      onSuccess: () => {
        onClose();
        navigate('/products');
      },
    });
  };

  const error =
    archiveProduct.error || deleteProduct.error || infoQuery.error
      ? formatMutationError(
          archiveProduct.error ??
            deleteProduct.error ??
            infoQuery.error ??
            'Request failed',
          'Action failed',
        )
      : null;

  return (
    <Modal
      open={open}
      title="Delete this product?"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={onArchive} disabled={pending}>
            {pending ? 'Working…' : 'Archive Product'}
          </Button>
          {info?.canPermanentlyDelete ? (
            <Button variant="primary" onClick={onDelete} disabled={pending}>
              {pending ? 'Deleting…' : 'Delete Permanently'}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="ga-product-delete">
        <p>
          You are about to remove <strong>{productName}</strong>. This may affect
          product history and existing orders.
        </p>
        {infoQuery.isLoading ? (
          <p className="ga-product-delete__hint">Checking dependencies…</p>
        ) : info ? (
          <ul className="ga-product-delete__checks">
            <li>
              Order lines: <strong>{info.orderLineCount}</strong>
            </li>
            <li>
              Inventory movements: <strong>{info.movementCount}</strong>
            </li>
            <li>
              Active stock: <strong>{info.hasStock ? 'Yes' : 'No'}</strong>
            </li>
          </ul>
        ) : null}
        {hasHistory || info?.hasStock ? (
          <p className="ga-product-delete__warn">
            This product has sales or inventory history.{' '}
            <strong>Archive Product</strong> is recommended — it hides the product
            from ordering while preserving history.
          </p>
        ) : info?.canPermanentlyDelete ? (
          <p className="ga-product-delete__hint">
            No order or inventory history found. Permanent deletion is available.
          </p>
        ) : null}
        {error ? <p className="ga-product-delete__error">{error}</p> : null}
      </div>
    </Modal>
  );
}
