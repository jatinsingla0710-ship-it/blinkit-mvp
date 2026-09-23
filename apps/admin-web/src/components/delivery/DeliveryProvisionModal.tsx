import { useEffect, useMemo, useState } from 'react';
import { Modal, TextField, SelectField, Button } from '@groaurum/ui';
import { deliveryProvisionSchema } from '@groaurum/validation';
import { activeServiceAreas } from '@/data/live-entity-helpers';
import { useServiceAreasListQuery } from '@/data/hooks';
import { formatMutationError } from '@/data/mutation-errors';
import {
  useProvisionDeliveryMutation,
  useUpsertDeliveryEmploymentMutation,
} from '@/data/mutations';
import '../salesmen/SalesmanProvisionModal.css';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (profileId: string) => void;
};

type FormState = {
  displayName: string;
  mobile: string;
  email: string;
  temporaryPassword: string;
  address: string;
  joiningDate: string;
  employmentStatus: 'ACTIVE' | 'INACTIVE';
  operationalStatus: 'AVAILABLE' | 'OFF_DUTY' | 'UNAVAILABLE';
  primaryServiceAreaId: string;
  idProofType: '' | 'AADHAAR' | 'PAN' | 'OTHER';
  idProofNumber: string;
};

const EMPTY: FormState = {
  displayName: '',
  mobile: '',
  email: '',
  temporaryPassword: '',
  address: '',
  joiningDate: new Date().toISOString().slice(0, 10),
  employmentStatus: 'ACTIVE',
  operationalStatus: 'AVAILABLE',
  primaryServiceAreaId: '',
  idProofType: '',
  idProofNumber: '',
};

/**
 * Auth-backed delivery boy provision + employment (H5).
 * Temporary password is set by Admin and shared out-of-band.
 */
export function DeliveryProvisionModal({ open, onClose, onSuccess }: Props) {
  const provision = useProvisionDeliveryMutation();
  const upsertEmployment = useUpsertDeliveryEmploymentMutation();
  const { state: areasState } = useServiceAreasListQuery();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const serviceAreas = useMemo(
    () => activeServiceAreas(areasState.data ?? []),
    [areasState.data],
  );

  useEffect(() => {
    if (!open) return;
    setForm({
      ...EMPTY,
      joiningDate: new Date().toISOString().slice(0, 10),
      primaryServiceAreaId: serviceAreas[0]?.id ?? '',
    });
    setError(null);
    setSuccessNote(null);
    setSaving(false);
  }, [open, serviceAreas]);

  const pending = saving || provision.isPending || upsertEmployment.isPending;

  const onSubmit = async () => {
    setError(null);
    setSuccessNote(null);
    const parsed = deliveryProvisionSchema.safeParse({
      displayName: form.displayName,
      mobile: form.mobile,
      email: form.email,
      temporaryPassword: form.temporaryPassword,
    });
    if (!parsed.success) {
      setError(formatMutationError(parsed.error, 'Invalid delivery details'));
      return;
    }
    setSaving(true);
    try {
      const result = await provision.mutateAsync(parsed.data);
      await upsertEmployment.mutateAsync({
        profileId: result.profileId,
        joiningDate: form.joiningDate,
        employmentStatus: form.employmentStatus,
        operationalStatus: form.operationalStatus,
        address: form.address.trim() || undefined,
        contactEmail: form.email.trim(),
        idProofType: form.idProofType || null,
        idProofNumber: form.idProofNumber.trim() || undefined,
        primaryServiceAreaId: form.primaryServiceAreaId || null,
      });
      setSuccessNote(
        result.alreadyProvisioned
          ? 'Existing delivery profile updated.'
          : 'Delivery boy provisioned. Share the temporary password out-of-band.',
      );
      onSuccess?.(result.profileId);
    } catch (err) {
      setError(formatMutationError(err, 'Could not provision delivery boy'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Delivery Boy"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void onSubmit()} disabled={pending}>
            {pending ? 'Creating…' : 'Create Delivery Account'}
          </Button>
        </>
      }
    >
      <div className="ga-sm-provision">
        <p className="ga-sm-provision__hint">
          Creates a login for the Delivery app. Share the temporary password
          yourself — nothing is emailed automatically. Salary is managed later
          on the delivery boy detail page if your company tracks it separately.
        </p>
        <div className="ga-sm-provision__row">
          <TextField
            label="Full name"
            value={form.displayName}
            onChange={(e) =>
              setForm((f) => ({ ...f, displayName: e.target.value }))
            }
          />
          <TextField
            label="Mobile"
            value={form.mobile}
            onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
          />
        </div>
        <div className="ga-sm-provision__row">
          <TextField
            label="Email (login)"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <TextField
            label="Temporary password"
            type="password"
            value={form.temporaryPassword}
            onChange={(e) =>
              setForm((f) => ({ ...f, temporaryPassword: e.target.value }))
            }
          />
        </div>
        <div className="ga-sm-provision__row">
          <TextField
            label="Joining date"
            type="date"
            value={form.joiningDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, joiningDate: e.target.value }))
            }
          />
          <SelectField
            label="Employment"
            value={form.employmentStatus}
            onChange={(employmentStatus) =>
              setForm((f) => ({
                ...f,
                employmentStatus: employmentStatus as 'ACTIVE' | 'INACTIVE',
              }))
            }
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </SelectField>
        </div>
        <div className="ga-sm-provision__row">
          <SelectField
            label="Operational status"
            value={form.operationalStatus}
            onChange={(operationalStatus) =>
              setForm((f) => ({
                ...f,
                operationalStatus: operationalStatus as FormState['operationalStatus'],
              }))
            }
          >
            <option value="AVAILABLE">Available</option>
            <option value="OFF_DUTY">Off duty</option>
            <option value="UNAVAILABLE">Unavailable</option>
          </SelectField>
          <SelectField
            label="Primary service area"
            value={form.primaryServiceAreaId}
            onChange={(primaryServiceAreaId) =>
              setForm((f) => ({ ...f, primaryServiceAreaId }))
            }
          >
            <option value="">None</option>
            {serviceAreas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          label="Address"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
        {error ? <p className="ga-sm-provision__error">{error}</p> : null}
        {successNote ? (
          <p className="ga-sm-provision__success">{successNote}</p>
        ) : null}
      </div>
    </Modal>
  );
}
