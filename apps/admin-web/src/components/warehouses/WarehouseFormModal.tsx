import { useEffect, useState } from 'react';
import { Modal, TextField, SelectField, Button } from '@groaurum/ui';
import type { WarehouseListItem } from '@/data/warehouse-model';
import {
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
} from '@/data/mutations';
import './WarehouseFormModal.css';

export type WarehouseFormMode = 'create' | 'edit';

type Props = {
  open: boolean;
  mode: WarehouseFormMode;
  warehouse?: WarehouseListItem | null;
  onClose: () => void;
};

type FormState = {
  name: string;
  addressLine: string;
  city: string;
  state: string;
  pinCode: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: '',
  addressLine: '',
  city: '',
  state: '',
  pinCode: '',
  isActive: true,
};

export function WarehouseFormModal({
  open,
  mode,
  warehouse,
  onClose,
}: Props) {
  const createWarehouse = useCreateWarehouseMutation();
  const updateWarehouse = useUpdateWarehouseMutation();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && warehouse) {
      setForm({
        name: warehouse.name,
        addressLine: warehouse.addressLine,
        city: warehouse.city,
        state: warehouse.state,
        pinCode: warehouse.pinCode,
        isActive: warehouse.status === 'active',
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, mode, warehouse]);

  const pending = createWarehouse.isPending || updateWarehouse.isPending;

  const onSubmit = () => {
    const name = form.name.trim();
    const addressLine = form.addressLine.trim();
    const city = form.city.trim();
    const state = form.state.trim();
    const pinCode = form.pinCode.trim();
    if (!name || !addressLine || !city || !state || !pinCode) {
      setError('Name, address, city, state, and PIN code are required');
      return;
    }
    setError(null);
    const payload = {
      name,
      addressLine,
      city,
      state,
      pinCode,
      isActive: form.isActive,
    };
    if (mode === 'create') {
      createWarehouse.mutate(payload, {
        onSuccess: () => onClose(),
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Create failed'),
      });
      return;
    }
    if (!warehouse) return;
    updateWarehouse.mutate(
      { id: warehouse.id, input: payload },
      {
        onSuccess: () => onClose(),
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Update failed'),
      },
    );
  };

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Create Warehouse' : 'Edit Warehouse'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={pending}>
            {pending
              ? 'Saving…'
              : mode === 'create'
                ? 'Create Warehouse'
                : 'Save Changes'}
          </Button>
        </>
      }
    >
      <div className="ga-wh-form">
        <TextField
          label="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. GroAurum Warehouse 1"
          required
        />
        <TextField
          label="Address"
          value={form.addressLine}
          onChange={(e) =>
            setForm((f) => ({ ...f, addressLine: e.target.value }))
          }
          placeholder="Street / building / complex"
          required
        />
        <TextField
          label="City"
          value={form.city}
          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          required
        />
        <TextField
          label="State"
          value={form.state}
          onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
          required
        />
        <TextField
          label="PIN Code"
          value={form.pinCode}
          onChange={(e) => setForm((f) => ({ ...f, pinCode: e.target.value }))}
          placeholder="6-digit PIN"
          inputMode="numeric"
          maxLength={6}
          required
        />
        <SelectField
          label="Status"
          value={form.isActive ? 'active' : 'inactive'}
          onChange={(v) =>
            setForm((f) => ({ ...f, isActive: v === 'active' }))
          }
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </SelectField>
        {error ? <p className="ga-wh-form__error">{error}</p> : null}
      </div>
    </Modal>
  );
}
