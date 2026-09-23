import { useEffect, useState } from 'react';
import { Button, TextField } from '@groaurum/ui';
import type { CompanyProfile } from '@/data/settings-types';
import { companyProfileToSettingsValue } from '@/data/company-settings-map';
import { formatMutationError } from '@/data/mutation-errors';
import './CompanyProfileSection.css';

type Props = {
  company: CompanyProfile;
  canEdit: boolean;
  saving?: boolean;
  onSave: (company: CompanyProfile) => Promise<void>;
};

export function CompanyProfileSection({
  company,
  canEdit,
  saving = false,
  onSave,
}: Props) {
  const [form, setForm] = useState<CompanyProfile>(company);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setForm(company);
    setError(null);
  }, [company]);

  const setField = <K extends keyof CompanyProfile>(
    key: K,
    value: CompanyProfile[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  };

  const onSubmit = async () => {
    if (!canEdit) return;
    setError(null);
    try {
      const normalized = companyProfileToSettingsValue(form);
      setForm(normalized);
      await onSave(normalized);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(formatMutationError(err, 'Could not save company profile'));
    }
  };

  const disabled = !canEdit || saving;

  return (
    <div className="ga-st-company">
      <div className="ga-st-company__grid">
        <TextField
          label="Company Name"
          name="companyName"
          value={form.companyName}
          onChange={(e) => setField('companyName', e.target.value)}
          disabled={disabled}
          required
        />
        <TextField
          label="GST Number"
          name="gstNumber"
          value={form.gstNumber}
          onChange={(e) => setField('gstNumber', e.target.value)}
          disabled={disabled}
          className="ga-st-mono-input"
        />
        <TextField
          label="PAN"
          name="pan"
          value={form.pan}
          onChange={(e) => setField('pan', e.target.value)}
          disabled={disabled}
          className="ga-st-mono-input"
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
          disabled={disabled}
        />
        <TextField
          label="Phone"
          name="phone"
          value={form.phone}
          onChange={(e) => setField('phone', e.target.value)}
          disabled={disabled}
        />
        <TextField
          label="Logo"
          name="logo"
          value={form.logo}
          onChange={(e) => setField('logo', e.target.value)}
          disabled={disabled}
          hint="Filename or label only — image upload comes later"
        />
        <TextField
          label="Business Address"
          name="address"
          value={form.address}
          onChange={(e) => setField('address', e.target.value)}
          disabled={disabled}
          grow
          className="ga-st-company__address"
        />
      </div>

      {error ? <p className="ga-st-company__error">{error}</p> : null}
      {savedAt && !error ? (
        <p className="ga-st-company__ok">Saved at {savedAt}</p>
      ) : null}

      <div className="ga-st-company__actions">
        <Button
          variant="primary"
          onClick={() => void onSubmit()}
          disabled={disabled}
        >
          {saving ? 'Saving…' : 'Save Company Profile'}
        </Button>
        {!canEdit ? (
          <span className="ga-st-company__hint">
            You do not have permission to edit company settings.
          </span>
        ) : null}
      </div>
    </div>
  );
}
