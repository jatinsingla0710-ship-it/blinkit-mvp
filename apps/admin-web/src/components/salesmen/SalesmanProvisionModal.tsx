import { useEffect, useMemo, useState } from 'react';
import { Modal, TextField, SelectField, Button } from '@groaurum/ui';
import { salesmanProvisionSchema } from '@groaurum/validation';
import { activeServiceAreas } from '@/data/live-entity-helpers';
import { useServiceAreasListQuery } from '@/data/hooks';
import { formatMutationError } from '@/data/mutation-errors';
import {
  useProvisionSalesmanMutation,
  useSetSalesmanSalaryTermsMutation,
  useUpsertSalesmanEmploymentMutation,
} from '@/data/mutations';
import { DOW_LABELS, type Dow } from '@/data/salesman-salary';
import './SalesmanProvisionModal.css';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (profileId: string) => void;
};

type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
type IdProofType = '' | 'AADHAAR' | 'PAN' | 'OTHER';

type FormState = {
  displayName: string;
  mobile: string;
  email: string;
  temporaryPassword: string;
  address: string;
  idProofType: IdProofType;
  idProofNumber: string;
  joiningDate: string;
  employmentStatus: EmploymentStatus;
  primaryServiceAreaId: string;
  weeklyOffDow: number;
  workingDays: number[];
  monthlySalary: string;
  dailyAllowance: string;
  otherAllowance: string;
};

const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6];

const EMPTY: FormState = {
  displayName: '',
  mobile: '',
  email: '',
  temporaryPassword: '',
  address: '',
  idProofType: '',
  idProofNumber: '',
  joiningDate: new Date().toISOString().slice(0, 10),
  employmentStatus: 'ACTIVE',
  primaryServiceAreaId: '',
  weeklyOffDow: 0,
  workingDays: [...DEFAULT_WORKING_DAYS],
  monthlySalary: '',
  dailyAllowance: '0',
  otherAllowance: '0',
};

const STEPS = ['Basic', 'Work', 'Salary'] as const;
const ALL_DOWS: Dow[] = [0, 1, 2, 3, 4, 5, 6];

function parseMoney(raw: string): number {
  const n = Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Auth-backed salesman provision (H3) + employment/salary (H4).
 * Temporary password is set by Admin and shared out-of-band — no OTP/SMS.
 */
export function SalesmanProvisionModal({ open, onClose, onSuccess }: Props) {
  const provision = useProvisionSalesmanMutation();
  const upsertEmployment = useUpsertSalesmanEmploymentMutation();
  const setSalary = useSetSalesmanSalaryTermsMutation();
  const { state: areasState } = useServiceAreasListQuery();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const serviceAreas = useMemo(
    () => activeServiceAreas(areasState.data ?? []),
    [areasState.data],
  );

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setForm({
      ...EMPTY,
      joiningDate: new Date().toISOString().slice(0, 10),
      primaryServiceAreaId: serviceAreas[0]?.id ?? '',
    });
    setError(null);
    setSuccessNote(null);
    setCreatedId(null);
    setSaving(false);
  }, [open, serviceAreas]);

  const pending =
    saving ||
    provision.isPending ||
    upsertEmployment.isPending ||
    setSalary.isPending;

  const toggleWorkingDay = (dow: number) => {
    setForm((f) => {
      const has = f.workingDays.includes(dow);
      const next = has
        ? f.workingDays.filter((d) => d !== dow)
        : [...f.workingDays, dow].sort((a, b) => a - b);
      return { ...f, workingDays: next };
    });
  };

  const validateStep = (current: number): string | null => {
    if (current === 1) {
      const parsed = salesmanProvisionSchema.safeParse({
        displayName: form.displayName,
        mobile: form.mobile,
        email: form.email,
        temporaryPassword: form.temporaryPassword,
      });
      if (!parsed.success) {
        return formatMutationError(parsed.error, 'Invalid salesman details');
      }
      return null;
    }
    if (current === 2) {
      if (!form.joiningDate) return 'Joining date is required';
      if (form.workingDays.length === 0) {
        return 'Select at least one working day';
      }
      if (form.workingDays.every((d) => d === form.weeklyOffDow)) {
        return 'Working days cannot be only the weekly off day';
      }
      return null;
    }
    const monthly = parseMoney(form.monthlySalary || '0');
    if (form.monthlySalary.trim() && (!Number.isFinite(monthly) || monthly < 0)) {
      return 'Monthly salary must be a non-negative number';
    }
    const da = parseMoney(form.dailyAllowance || '0');
    const other = parseMoney(form.otherAllowance || '0');
    if (!Number.isFinite(da) || da < 0) return 'DA must be a non-negative number';
    if (!Number.isFinite(other) || other < 0) {
      return 'Other allowance must be a non-negative number';
    }
    return null;
  };

  const goNext = () => {
    setError(null);
    const msg = validateStep(step);
    if (msg) {
      setError(msg);
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const onSubmit = async () => {
    setError(null);
    setSuccessNote(null);
    for (let s = 1; s <= 3; s += 1) {
      const msg = validateStep(s);
      if (msg) {
        setStep(s);
        setError(msg);
        return;
      }
    }

    const basic = salesmanProvisionSchema.parse({
      displayName: form.displayName,
      mobile: form.mobile,
      email: form.email,
      temporaryPassword: form.temporaryPassword,
    });

    setSaving(true);
    try {
      const result = await provision.mutateAsync(basic);
      const profileId = result.profileId;

      const workingDays = form.workingDays.filter(
        (d) => d !== form.weeklyOffDow,
      );
      await upsertEmployment.mutateAsync({
        profileId,
        joiningDate: form.joiningDate,
        employmentStatus: form.employmentStatus,
        address: form.address.trim() || undefined,
        contactEmail: form.email.trim(),
        idProofType: form.idProofType || null,
        idProofNumber: form.idProofNumber.trim() || undefined,
        primaryServiceAreaId: form.primaryServiceAreaId || null,
        weeklyOffDow: form.weeklyOffDow,
        workingDays: workingDays.length ? workingDays : form.workingDays,
      });

      const monthly = parseMoney(form.monthlySalary || '0');
      if (monthly > 0) {
        await setSalary.mutateAsync({
          profileId,
          monthlySalary: monthly,
          dailyAllowance: parseMoney(form.dailyAllowance || '0') || 0,
          otherAllowance: parseMoney(form.otherAllowance || '0') || 0,
          effectiveFrom: form.joiningDate,
        });
      }

      setCreatedId(profileId);
      if (result.alreadyProvisioned) {
        setSuccessNote(
          'Salesman already provisioned for this mobile/email. Employment/salary updated. Opening existing profile.',
        );
      } else if (result.createdAuthUser) {
        setSuccessNote(
          'Auth user + SALESMAN profile created with work & salary terms. Share the temporary password out-of-band so they can sign in to the Sales PWA.',
        );
      } else {
        setSuccessNote(
          'SALESMAN profile linked to an existing Auth user with work & salary terms. They can sign in with their existing credentials.',
        );
      }
      onSuccess?.(profileId);
    } catch (err) {
      setError(formatMutationError(err, 'Could not provision salesman'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Provision Salesman"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {createdId ? 'Close' : 'Cancel'}
          </Button>
          {!createdId && step > 1 ? (
            <Button
              variant="ghost"
              onClick={() => {
                setError(null);
                setStep((s) => s - 1);
              }}
              disabled={pending}
            >
              Back
            </Button>
          ) : null}
          {!createdId && step < 3 ? (
            <Button variant="primary" onClick={goNext} disabled={pending}>
              Next
            </Button>
          ) : null}
          {!createdId && step === 3 ? (
            <Button variant="primary" onClick={onSubmit} disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="ga-sm-provision">
        {!createdId ? (
          <ol className="ga-sm-provision__steps" aria-label="Provision steps">
            {STEPS.map((label, idx) => {
              const n = idx + 1;
              return (
                <li
                  key={label}
                  className={
                    step === n ? 'is-active' : step > n ? 'is-done' : ''
                  }
                >
                  {label}
                </li>
              );
            })}
          </ol>
        ) : null}

        {createdId ? null : step === 1 ? (
          <>
            <p className="ga-sm-provision__hint" role="status">
              Creates a Supabase Auth user and matching{' '}
              <code>profiles</code> row with the <code>SALESMAN</code> role.
              No OTP/SMS — share the temporary password securely yourself.
            </p>
            <TextField
              label="Display name"
              value={form.displayName}
              onChange={(e) =>
                setForm((f) => ({ ...f, displayName: e.target.value }))
              }
            />
            <TextField
              label="Mobile"
              value={form.mobile}
              onChange={(e) =>
                setForm((f) => ({ ...f, mobile: e.target.value }))
              }
              placeholder="10–15 digits"
            />
            <TextField
              label="Login email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="salesman@example.com"
            />
            <TextField
              label="Temporary password"
              type="password"
              value={form.temporaryPassword}
              onChange={(e) =>
                setForm((f) => ({ ...f, temporaryPassword: e.target.value }))
              }
              placeholder="Min 8 characters"
            />
            <TextField
              label="Address (optional)"
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
            />
            <div className="ga-sm-provision__row">
              <SelectField
                label="ID proof type"
                value={form.idProofType}
                onChange={(idProofType) =>
                  setForm((f) => ({
                    ...f,
                    idProofType: idProofType as IdProofType,
                  }))
                }
              >
                <option value="">None</option>
                <option value="AADHAAR">Aadhaar</option>
                <option value="PAN">PAN</option>
                <option value="OTHER">Other</option>
              </SelectField>
              <TextField
                label="ID proof number"
                value={form.idProofNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, idProofNumber: e.target.value }))
                }
                disabled={!form.idProofType}
              />
            </div>
          </>
        ) : null}

        {createdId ? null : step === 2 ? (
          <>
            <TextField
              label="Joining date"
              type="date"
              value={form.joiningDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, joiningDate: e.target.value }))
              }
            />
            <SelectField
              label="Employment status"
              value={form.employmentStatus}
              onChange={(employmentStatus) =>
                setForm((f) => ({
                  ...f,
                  employmentStatus: employmentStatus as EmploymentStatus,
                }))
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </SelectField>
            <SelectField
              label="Service area"
              value={form.primaryServiceAreaId}
              onChange={(primaryServiceAreaId) =>
                setForm((f) => ({ ...f, primaryServiceAreaId }))
              }
            >
              <option value="">None</option>
              {serviceAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </SelectField>
            {serviceAreas.length === 0 ? (
              <p className="ga-sm-provision__hint">
                No active service areas yet. You can assign one later from the
                Work tab.
              </p>
            ) : null}
            <SelectField
              label="Weekly off"
              value={String(form.weeklyOffDow)}
              onChange={(v) => {
                const weeklyOffDow = Number(v);
                setForm((f) => ({
                  ...f,
                  weeklyOffDow,
                  workingDays: f.workingDays.filter((d) => d !== weeklyOffDow),
                }));
              }}
            >
              {ALL_DOWS.map((dow) => (
                <option key={dow} value={dow}>
                  {DOW_LABELS[dow]}
                </option>
              ))}
            </SelectField>
            <fieldset className="ga-sm-provision__days">
              <legend>Working days</legend>
              <div className="ga-sm-provision__day-grid">
                {ALL_DOWS.map((dow) => (
                  <label key={dow} className="ga-sm-provision__day">
                    <input
                      type="checkbox"
                      checked={form.workingDays.includes(dow)}
                      disabled={dow === form.weeklyOffDow}
                      onChange={() => toggleWorkingDay(dow)}
                    />
                    {DOW_LABELS[dow].slice(0, 3)}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="ga-sm-provision__hint">
              Assigned shops are linked via Customers / salesman reassign after
              provision — this step only sets the primary service area.
            </p>
          </>
        ) : null}

        {createdId ? null : step === 3 ? (
          <>
            <p className="ga-sm-provision__hint">
              Leave monthly salary at 0 to skip salary terms for now. You can
              set them later on the Salary tab.
            </p>
            <TextField
              label="Monthly salary (₹)"
              value={form.monthlySalary}
              onChange={(e) =>
                setForm((f) => ({ ...f, monthlySalary: e.target.value }))
              }
              placeholder="0"
            />
            <div className="ga-sm-provision__row">
              <TextField
                label="Daily allowance / DA (₹)"
                value={form.dailyAllowance}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dailyAllowance: e.target.value }))
                }
              />
              <TextField
                label="Other allowance (₹)"
                value={form.otherAllowance}
                onChange={(e) =>
                  setForm((f) => ({ ...f, otherAllowance: e.target.value }))
                }
              />
            </div>
          </>
        ) : null}

        {error ? <p className="ga-sm-provision__error">{error}</p> : null}
        {successNote ? (
          <p className="ga-sm-provision__success" role="status">
            {successNote}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
