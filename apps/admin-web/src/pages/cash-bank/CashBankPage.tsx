import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useCashBankSnapshotQuery } from '@/data/hooks';
import {
  useRecordCashBankExternalMutation,
  useRecordCashBankOpeningMutation,
  useRecordCashBankTransferMutation,
} from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import { todayExpenseDate } from '@/data/company-expenses';
import type {
  CashBankAccountKind,
  CashBankExternalKind,
  CashBankTransferDirection,
} from '@/data/cash-bank';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import '@groaurum/ui/styles/data-table.css';
import './CashBankPage.css';

type ActionMode = 'transfer' | 'opening' | 'external';

/**
 * Phase 7 Cash & Bank — ledger balances only; never invent unverified cash.
 */
export function CashBankPage() {
  const today = todayExpenseDate();
  const [asOfDate, setAsOfDate] = useState(today);
  const { state, refetch } = useCashBankSnapshotQuery({ asOfDate });

  const transferMutation = useRecordCashBankTransferMutation();
  const openingMutation = useRecordCashBankOpeningMutation();
  const externalMutation = useRecordCashBankExternalMutation();

  const [mode, setMode] = useState<ActionMode>('transfer');
  const [entryDate, setEntryDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [direction, setDirection] =
    useState<CashBankTransferDirection>('cash_to_bank');
  const [account, setAccount] = useState<CashBankAccountKind>('cash');
  const [kind, setKind] = useState<CashBankExternalKind>('deposit');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const pending =
    transferMutation.isPending ||
    openingMutation.isPending ||
    externalMutation.isPending;

  const resetAmounts = () => {
    setAmount('');
    setCashAmount('');
    setBankAmount('');
    setMemo('');
  };

  const onSubmit = async () => {
    setError(null);
    setMessage(null);
    try {
      if (mode === 'transfer') {
        const value = Number(amount);
        if (!(value > 0)) throw new Error('Enter a transfer amount greater than 0');
        await transferMutation.mutateAsync({
          entryDate,
          amount: value,
          direction,
          memo: memo || null,
        });
        setMessage('Transfer posted to Books.');
      } else if (mode === 'opening') {
        await openingMutation.mutateAsync({
          entryDate,
          cashAmount: Number(cashAmount) || 0,
          bankAmount: Number(bankAmount) || 0,
          memo: memo || null,
        });
        setMessage('Verified opening balance posted to Books.');
      } else {
        const value = Number(amount);
        if (!(value > 0)) throw new Error('Enter an amount greater than 0');
        await externalMutation.mutateAsync({
          entryDate,
          account,
          kind,
          amount: value,
          memo: memo || null,
        });
        setMessage(
          kind === 'deposit'
            ? 'Deposit posted to Books.'
            : 'Withdrawal posted to Books.',
        );
      }
      resetAmounts();
      await refetch();
    } catch (err) {
      setError(formatMutationError(err, 'Could not save cash/bank entry'));
    }
  };

  return (
    <div className="ga-cashbank">
      <PageHeader
        title="Cash & Bank"
        subtitle="Cash in hand and bank balance from posted Books only"
        meta={`As of ${asOfDate}`}
        actions={
          <Link className="ga-btn ga-btn--secondary" to="/accounting">
            Open Books
          </Link>
        }
      />

      <SectionRelatedLinks
        label="Money"
        links={[...ACCOUNTING_SECTION_LINKS]}
      />

      <div className="ga-cashbank__toolbar">
        <label>
          <span className="ga-sr-only">As of date</span>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
          />
        </label>
      </div>

      <QueryStateGate title="Cash & Bank" state={state}>
        {(snapshot) => (
          <>
            <KpiCards
              items={[
                {
                  id: 'cash',
                  label: 'Cash in hand',
                  value: snapshot.cashBalanceLabel,
                  tone: 'positive',
                },
                {
                  id: 'bank',
                  label: 'Bank balance',
                  value: snapshot.bankBalanceLabel,
                  tone: 'positive',
                },
                {
                  id: 'due',
                  label: 'Money expected',
                  value: snapshot.moneyExpectedLabel,
                  hint: 'Customers owe you',
                  href: '/receivables',
                },
                {
                  id: 'pay',
                  label: 'Money to pay',
                  value: snapshot.moneyToPayLabel,
                  hint: 'Supplier dues',
                  href: '/payables',
                },
              ]}
            />

            <p className="ga-cashbank__note">{snapshot.honestyNote}</p>

            <section className="ga-cashbank__card">
              <h2>Record verified money move</h2>
              <div className="ga-cashbank__modes" role="tablist">
                {(
                  [
                    ['transfer', 'Transfer'],
                    ['opening', 'Opening'],
                    ['external', 'Deposit / Withdraw'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={
                      mode === id
                        ? 'ga-cashbank__mode ga-cashbank__mode--active'
                        : 'ga-cashbank__mode'
                    }
                    onClick={() => setMode(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="ga-cashbank__form">
                <label>
                  Date
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                </label>

                {mode === 'transfer' ? (
                  <>
                    <label>
                      Direction
                      <select
                        value={direction}
                        onChange={(e) =>
                          setDirection(
                            e.target.value as CashBankTransferDirection,
                          )
                        }
                      >
                        <option value="cash_to_bank">Cash → Bank</option>
                        <option value="bank_to_cash">Bank → Cash</option>
                      </select>
                    </label>
                    <label>
                      Amount
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </label>
                  </>
                ) : null}

                {mode === 'opening' ? (
                  <>
                    <label>
                      Cash opening
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                      />
                    </label>
                    <label>
                      Bank opening
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={bankAmount}
                        onChange={(e) => setBankAmount(e.target.value)}
                      />
                    </label>
                  </>
                ) : null}

                {mode === 'external' ? (
                  <>
                    <label>
                      Account
                      <select
                        value={account}
                        onChange={(e) =>
                          setAccount(e.target.value as CashBankAccountKind)
                        }
                      >
                        <option value="cash">Cash</option>
                        <option value="bank">Bank</option>
                      </select>
                    </label>
                    <label>
                      Type
                      <select
                        value={kind}
                        onChange={(e) =>
                          setKind(e.target.value as CashBankExternalKind)
                        }
                      >
                        <option value="deposit">Deposit</option>
                        <option value="withdrawal">Withdrawal</option>
                      </select>
                    </label>
                    <label>
                      Amount
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </label>
                  </>
                ) : null}

                <label>
                  Note
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="Optional reference"
                  />
                </label>

                <Button
                  variant="primary"
                  disabled={pending}
                  onClick={() => void onSubmit()}
                >
                  {pending ? 'Saving…' : 'Post to Books'}
                </Button>
              </div>

              {error ? <p className="ga-cashbank__error">{error}</p> : null}
              {message ? <p className="ga-cashbank__note">{message}</p> : null}
            </section>

            <section className="ga-cashbank__card">
              <h2>Cash & bank movements</h2>
              {snapshot.movements.length === 0 ? (
                <EmptyState
                  title="No cash or bank movements"
                  detail="Update Books for collections and expenses, or post a verified opening balance."
                />
              ) : (
                <div className="ga-table-wrap">
                  <table className="ga-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Account</th>
                        <th>Type</th>
                        <th>Memo</th>
                        <th>In</th>
                        <th>Out</th>
                        <th>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.movements.map((row) => (
                        <tr key={row.id}>
                          <td>{row.entryDateLabel}</td>
                          <td>{row.accountLabel}</td>
                          <td>{row.sourceTypeLabel}</td>
                          <td>{row.memo}</td>
                          <td>{row.debit > 0 ? row.amountLabel : '—'}</td>
                          <td>{row.credit > 0 ? row.amountLabel : '—'}</td>
                          <td>{row.runningBalanceLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </QueryStateGate>
    </div>
  );
}
