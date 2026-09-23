import { useEffect, useState } from 'react';
import { Modal, TextField, SelectField, Button } from '@groaurum/ui';
import type { ServiceAreaListItem } from '@/data/service-area-model';
import {
  useCreateServiceAreaMutation,
  useUpdateServiceAreaMutation,
} from '@/data/mutations';
import './ServiceAreaFormModal.css';

export type ServiceAreaFormMode = 'create' | 'edit';

type Props = {
  open: boolean;
  mode: ServiceAreaFormMode;
  area?: ServiceAreaListItem | null;
  onClose: () => void;
};

type FormState = {
  name: string;
  description: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: '',
  description: '',
  isActive: true,
};

export function ServiceAreaFormModal({ open, mode, area, onClose }: Props) {
  const createArea = useCreateServiceAreaMutation();
  const updateArea = useUpdateServiceAreaMutation();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && area) {
      setForm({
        name: area.name,
        description: area.description,
        isActive: area.status === 'active',
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, mode, area]);

  const pending = createArea.isPending || updateArea.isPending;

  const onSubmit = () => {
    const name = form.name.trim();
    if (!name) {
      setError('Name is required');
      return;
    }
    setError(null);
    const description = form.description.trim();
    if (mode === 'create') {
      createArea.mutate(
        {
          name,
          description: description || undefined,
          isActive: form.isActive,
        },
        {
          onSuccess: () => onClose(),
          onError: (err) =>
            setError(err instanceof Error ? err.message : 'Create failed'),
        },
      );
      return;
    }
    if (!area) return;
    updateArea.mutate(
      {
        id: area.id,
        input: {
          name,
          description: description || undefined,
          isActive: form.isActive,
        },
      },
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
      title={mode === 'create' ? 'Create Service Area' : 'Edit Service Area'}
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
                ? 'Create Service Area'
                : 'Save Changes'}
          </Button>
        </>
      }
    >
      <div className="ga-sa-form">
        <TextField
          label="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. South Delhi"
          required
        />
        <label className="ga-sa-form__textarea">
          <span className="ga-sa-form__label">Description</span>
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={3}
            placeholder="Optional operational notes"
          />
        </label>
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
        {error ? <p className="ga-sa-form__error">{error}</p> : null}
      </div>
    </Modal>
  );
}
