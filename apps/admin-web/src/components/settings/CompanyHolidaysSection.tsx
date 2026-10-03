import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, TextField } from '@groaurum/ui';
import { EmptyState } from '@/components/ui/EmptyState';
import { requireLiveAdminApi } from '@/data/adminDataClient';
import { formatMutationError } from '@/data/mutation-errors';
import { useUpsertCompanyHolidayMutation } from '@/data/mutations';
import { todayExpenseDate } from '@/data/company-expenses';
import '@groaurum/ui/styles/data-table.css';
import './CompanyHolidaysSection.css';

type Props = {
  canManage: boolean;
};

/**
 * Company holidays used by salesman salary scheduling (excludes holiday from unpaid leave).
 */
export function CompanyHolidaysSection({ canManage }: Props) {
  const holidays = useQuery({
    queryKey: ['groaurum', 'settings', 'company-holidays'],
    queryFn: () => requireLiveAdminApi().listCompanyHolidays(),
  });
  const upsert = useUpsertCompanyHolidayMutation();
  const [date, setDate] = useState(todayExpenseDate());
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const onSave = () => {
    setError(null);
    setOk(null);
    if (!date || !name.trim()) {
      setError('Date and name are required');
      return;
    }
    upsert.mutate(
      { holidayDate: date, name: name.trim() },
      {
        onSuccess: () => {
          setOk('Holiday saved');
          setName('');
        },
        onError: (err) =>
          setError(formatMutationError(err, 'Could not save holiday')),
      },
    );
  };

  return (
    <div className="ga-holidays">
      <p className="ga-holidays__hint">
        Company-wide holidays are excluded from scheduled working days for
        payroll. Area-specific holidays can still be set via API with a service
        area id.
      </p>

      {canManage ? (
        <div className="ga-holidays__form">
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Diwali"
          />
          <Button
            type="button"
            variant="primary"
            disabled={upsert.isPending}
            onClick={onSave}
          >
            {upsert.isPending ? 'Saving…' : 'Add holiday'}
          </Button>
          {error ? (
            <p className="ga-holidays__error" role="alert">
              {error}
            </p>
          ) : null}
          {ok ? (
            <p className="ga-holidays__ok" role="status">
              {ok}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="ga-holidays__hint">You need settings:manage to edit holidays.</p>
      )}

      {holidays.isPending ? (
        <p className="ga-holidays__hint">Loading holidays…</p>
      ) : null}
      {holidays.isError ? (
        <p className="ga-holidays__error" role="alert">
          {formatMutationError(holidays.error, 'Could not load holidays')}
        </p>
      ) : null}
      {holidays.data && holidays.data.length === 0 ? (
        <EmptyState
          title="No company holidays"
          detail="Add festival and public holidays so salary scheduling skips them."
        />
      ) : null}
      {holidays.data && holidays.data.length > 0 ? (
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Scope</th>
              </tr>
            </thead>
            <tbody>
              {holidays.data.map((row) => (
                <tr key={row.id}>
                  <td>{row.holidayDate}</td>
                  <td>{row.name}</td>
                  <td>{row.serviceAreaLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
