import { useState } from 'react';
import { Button, SelectField, TextField } from '@groaurum/ui';
import type {
  SalesmanAttendanceRow,
  SalesmanAttendanceStatusVm,
} from '@/data/salesmen-types';
import { AttendanceStatusBadge } from '@/components/salesmen/SalesmanStatusBadges';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatMutationError } from '@/data/mutation-errors';
import { useSetSalesmanAttendanceMutation } from '@/data/mutations';
import '@groaurum/ui/styles/data-table.css';
import './SalesmanAttendanceTab.css';

type Props = {
  profileId: string;
  rows: SalesmanAttendanceRow[];
  canManage: boolean;
};

const STATUS_OPTIONS: SalesmanAttendanceStatusVm[] = [
  'PRESENT',
  'ABSENT',
  'PAID_LEAVE',
  'UNPAID_LEAVE',
  'HOLIDAY',
  'WEEKLY_OFF',
];

function statusLabel(status: SalesmanAttendanceStatusVm): string {
  switch (status) {
    case 'PRESENT':
      return 'Present';
    case 'ABSENT':
      return 'Absent';
    case 'PAID_LEAVE':
      return 'Paid leave';
    case 'UNPAID_LEAVE':
      return 'Unpaid leave';
    case 'HOLIDAY':
      return 'Holiday';
    case 'WEEKLY_OFF':
      return 'Weekly off';
    default:
      return status;
  }
}

export function SalesmanAttendanceTab({
  profileId,
  rows,
  canManage,
}: Props) {
  const setAttendance = useSetSalesmanAttendanceMutation();
  const [workDate, setWorkDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [status, setStatus] = useState<SalesmanAttendanceStatusVm>('PRESENT');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okNote, setOkNote] = useState<string | null>(null);

  const pending = setAttendance.isPending;

  const onCorrect = () => {
    setError(null);
    setOkNote(null);
    if (!workDate) {
      setError('Work date is required');
      return;
    }
    if (!reason.trim()) {
      setError('Correction reason is required');
      return;
    }
    setAttendance.mutate(
      {
        profileId,
        workDate,
        status,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          setOkNote('Attendance saved.');
          setReason('');
        },
        onError: (err) => {
          setError(formatMutationError(err, 'Could not set attendance'));
        },
      },
    );
  };

  return (
    <div className="ga-sm-att">
      {canManage ? (
        <section className="ga-sm-att__form" aria-label="Correct attendance">
          <h3 className="ga-sm-att__heading">Correct attendance</h3>
          <div className="ga-sm-att__form-row">
            <TextField
              label="Work date"
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
            />
            <SelectField
              label="Status"
              value={status}
              onChange={(v) => setStatus(v as SalesmanAttendanceStatusVm)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {statusLabel(opt)}
                </option>
              ))}
            </SelectField>
          </div>
          <TextField
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required when correcting status"
          />
          <div className="ga-sm-att__form-actions">
            <Button
              variant="primary"
              onClick={onCorrect}
              disabled={pending}
            >
              {pending ? 'Saving…' : 'Save attendance'}
            </Button>
          </div>
          {error ? <p className="ga-sm-att__error">{error}</p> : null}
          {okNote ? (
            <p className="ga-sm-att__ok" role="status">
              {okNote}
            </p>
          ) : null}
        </section>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No attendance records"
          detail="Day-start / corrections for this salesman will appear here."
        />
      ) : (
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Day started</th>
                <th>Day ended</th>
                <th>Correction reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.workDateLabel}</td>
                  <td>
                    <AttendanceStatusBadge status={row.status} />
                  </td>
                  <td>{row.dayStartedAtLabel ?? '—'}</td>
                  <td>{row.dayEndedAtLabel ?? '—'}</td>
                  <td>{row.correctionReason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
