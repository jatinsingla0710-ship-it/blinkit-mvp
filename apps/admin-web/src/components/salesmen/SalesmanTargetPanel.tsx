import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, TextField } from '@groaurum/ui';
import { requireLiveAdminApi } from '@/data/adminDataClient';
import { formatMutationError } from '@/data/mutation-errors';
import { useSetSalesmanTargetMutation } from '@/data/mutations';
import { formatInr } from '@/data/live/format';
import './SalesmanTargetPanel.css';

type Props = {
  profileId: string;
  canManage: boolean;
};

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function SalesmanTargetPanel({ profileId, canManage }: Props) {
  const queryClient = useQueryClient();
  const setTarget = useSetSalesmanTargetMutation();
  const [month, setMonth] = useState(currentMonthValue);
  const [amountDraft, setAmountDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['groaurum', 'salesmen', 'target', profileId, month],
    queryFn: () => requireLiveAdminApi().getSalesmanTarget(profileId, `${month}-01`),
    enabled: Boolean(profileId && month),
  });

  const amount = amountDraft ?? (query.data ? String(query.data.targetAmount) : '');

  const onSave = () => {
    setError(null);
    setSaved(null);
    const targetAmount = Number(amount.replace(/,/g, '').trim());
    if (!Number.isFinite(targetAmount) || targetAmount < 0) {
      setError('Enter a target amount of zero or more.');
      return;
    }
    setTarget.mutate(
      { profileId, month: `${month}-01`, targetAmount },
      {
        onSuccess: async () => {
          setSaved('Target saved.');
          await queryClient.invalidateQueries({
            queryKey: ['groaurum', 'salesmen', 'target', profileId, month],
          });
        },
        onError: (err) => {
          setError(formatMutationError(err, 'Could not save the target'));
        },
      },
    );
  };

  return (
    <section className="ga-sm-target" aria-label="Monthly target">
      <h3 className="ga-sm-target__heading">Monthly target</h3>
      <p className="ga-sm-target__hint">
        Achieved means delivered and paid this month. Pending orders are not counted.
      </p>
      <TextField
        label="Month"
        type="month"
        value={month}
        onChange={(event) => {
          setMonth(event.target.value);
          setAmountDraft(null);
          setSaved(null);
        }}
      />

      {query.isPending ? <p className="ga-sm-target__hint">Loading target…</p> : null}
      {query.isError ? (
        <p className="ga-sm-target__error" role="alert">
          {formatMutationError(query.error, 'Could not load the target')}
        </p>
      ) : null}

      {query.isSuccess && !query.data ? (
        <p className="ga-sm-target__hint">No target for this month.</p>
      ) : null}

      {query.data ? (
        <dl className="ga-sm-target__stats">
          <div>
            <dt>Target</dt>
            <dd>{formatInr(query.data.targetAmount)}</dd>
          </div>
          <div>
            <dt>Achieved</dt>
            <dd>{formatInr(query.data.achievedAmount)}</dd>
          </div>
          <div>
            <dt>Remaining</dt>
            <dd>{formatInr(query.data.remainingAmount)}</dd>
          </div>
          <div>
            <dt>Progress</dt>
            <dd>{query.data.progressPercent}%</dd>
          </div>
        </dl>
      ) : null}

      {canManage ? (
        <>
          <TextField
            label="Target amount (₹)"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmountDraft(event.target.value)}
          />
          <div className="ga-sm-target__actions">
            <Button type="button" variant="primary" onClick={onSave} disabled={setTarget.isPending}>
              {setTarget.isPending ? 'Saving…' : query.data ? 'Update target' : 'Set target'}
            </Button>
          </div>
        </>
      ) : null}

      {error ? (
        <p className="ga-sm-target__error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="ga-sm-target__ok" role="status">
          {saved}
        </p>
      ) : null}
    </section>
  );
}
