import { useEffect, useMemo, useState } from 'react';
import { Modal, SelectField, Button } from '@groaurum/ui';
import { activeSalesmen } from '@/data/live-entity-helpers';
import { useSalesmenSnapshotQuery } from '@/data/hooks';
import { useReassignShopSalesmanMutation } from '@/data/mutations';
import './SalesmanReassignModal.css';

type Props = {
  open: boolean;
  customerId: string;
  currentSalesmanProfileId?: string;
  onClose: () => void;
};

/**
 * Atomic reassignment via admin_reassign_shop_salesman (Salesman H2).
 * Closes active shop_salesman_assignments history and opens a new row.
 */
export function SalesmanReassignModal({
  open,
  customerId,
  currentSalesmanProfileId,
  onClose,
}: Props) {
  const reassign = useReassignShopSalesmanMutation();
  const { state: salesmenState } = useSalesmenSnapshotQuery();
  const [salesmanId, setSalesmanId] = useState('');
  const [reason, setReason] = useState('Reassigned by Admin');
  const [error, setError] = useState<string | null>(null);

  const salesmen = useMemo(
    () => activeSalesmen(salesmenState.data?.rows ?? []),
    [salesmenState.data],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setReason('Reassigned by Admin');
    const fallback =
      currentSalesmanProfileId &&
      salesmen.some((row) => row.id === currentSalesmanProfileId)
        ? currentSalesmanProfileId
        : salesmen[0]?.id ?? '';
    setSalesmanId(fallback);
  }, [open, currentSalesmanProfileId, salesmen]);

  const pending = reassign.isPending;
  const missingSalesmen = salesmen.length === 0;

  const onSubmit = () => {
    if (!salesmanId) {
      setError('Select an active salesman');
      return;
    }
    setError(null);
    reassign.mutate(
      {
        shopId: customerId,
        salesmanProfileId: salesmanId,
        reason: reason.trim() || 'Reassigned by Admin',
      },
      {
        onSuccess: () => onClose(),
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Reassign failed'),
      },
    );
  };

  return (
    <Modal
      open={open}
      title="Reassign Salesman"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={pending || missingSalesmen}
          >
            {pending ? 'Saving…' : 'Reassign salesman'}
          </Button>
        </>
      }
    >
      <div className="ga-cust-reassign">
        <p className="ga-cust-reassign__warning" role="status">
          Closes the previous active{' '}
          <code>shop_salesman_assignments</code> row (keeps history) and opens a
          new assignment for the selected salesman. Also updates{' '}
          <code>shops.assigned_salesman_profile_id</code>. Requires Admin.
        </p>
        {missingSalesmen ? (
          <p className="ga-cust-reassign__error">
            No active salesmen are available to assign.
          </p>
        ) : (
          <SelectField
            label="Salesman"
            value={salesmanId}
            onChange={setSalesmanId}
          >
            <option value="">Select salesman</option>
            {salesmen.map((salesman) => (
              <option key={salesman.id} value={salesman.id}>
                {salesman.name}
              </option>
            ))}
          </SelectField>
        )}
        <label className="ga-cust-reassign__reason">
          Reason
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reassigned by Admin"
          />
        </label>
        {error ? <p className="ga-cust-reassign__error">{error}</p> : null}
      </div>
    </Modal>
  );
}
