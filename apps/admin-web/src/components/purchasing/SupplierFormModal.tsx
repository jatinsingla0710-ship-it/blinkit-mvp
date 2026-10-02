import { useEffect, useState } from 'react';
import { Button, Modal, TextField } from '@groaurum/ui';
import {
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
} from '@/data/mutations';
import type { SupplierInput, SupplierRow } from '@/data/purchasing';
import { formatMutationError } from '@/data/mutation-errors';

type Props = {
  open: boolean;
  onClose: () => void;
  supplier?: SupplierRow | null;
};

const EMPTY: SupplierInput = {
  name: '',
  contactPerson: '',
  mobile: '',
  email: '',
  addressLine: '',
  city: '',
  state: '',
  gstin: '',
  notes: '',
  isActive: true,
};

export function SupplierFormModal({ open, onClose, supplier }: Props) {
  const createMutation = useCreateSupplierMutation();
  const updateMutation = useUpdateSupplierMutation();
  const [form, setForm] = useState<SupplierInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const pending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (supplier) {
      setForm({
        name: supplier.name,
        contactPerson: supplier.contactPerson ?? '',
        mobile: supplier.mobileLabel ?? '',
        email: supplier.email ?? '',
        addressLine: supplier.addressLine ?? '',
        city: supplier.city ?? '',
        state: supplier.state ?? '',
        gstin: supplier.gstin ?? '',
        notes: supplier.notes ?? '',
        isActive: supplier.isActive,
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, supplier]);

  const onSave = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError('Supplier name is required');
      return;
    }
    try {
      if (supplier) {
        await updateMutation.mutateAsync({ id: supplier.id, input: form });
      } else {
        await createMutation.mutateAsync(form);
      }
      onClose();
    } catch (err) {
      setError(formatMutationError(err, 'Could not save supplier'));
    }
  };

  return (
    <Modal
      open={open}
      title={supplier ? 'Edit supplier' : 'Add supplier'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void onSave()} disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="ga-purchasing__form">
        <TextField
          label="Business name"
          value={form.name ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <TextField
          label="Contact person"
          value={form.contactPerson ?? ''}
          onChange={(e) =>
            setForm((f) => ({ ...f, contactPerson: e.target.value }))
          }
        />
        <TextField
          label="Mobile"
          value={form.mobile ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
        />
        <TextField
          label="Email"
          value={form.email ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <TextField
          label="Address"
          value={form.addressLine ?? ''}
          onChange={(e) =>
            setForm((f) => ({ ...f, addressLine: e.target.value }))
          }
        />
        <TextField
          label="City"
          value={form.city ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
        />
        <TextField
          label="State"
          value={form.state ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
        />
        <TextField
          label="GSTIN (optional)"
          value={form.gstin ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
        />
        <TextField
          label="Notes"
          value={form.notes ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
        <label>
          <input
            type="checkbox"
            checked={form.isActive !== false}
            onChange={(e) =>
              setForm((f) => ({ ...f, isActive: e.target.checked }))
            }
          />{' '}
          Active
        </label>
        {error ? <p className="ga-purchasing__error">{error}</p> : null}
      </div>
    </Modal>
  );
}
