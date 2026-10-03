import { useState } from 'react';
import { Button } from '@groaurum/ui';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useAccountingSnapshotQuery } from '@/data/hooks';
import { useSyncAccountingJournalsMutation } from '@/data/mutations';
import { formatMutationError } from '@/data/mutation-errors';
import { todayExpenseDate } from '@/data/company-expenses';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import '@groaurum/ui/styles/data-table.css';
import './AccountingPage.css';

/**
 * Phase 6 Books — chart of accounts, journals from domain events, trial balance.
 */
export function AccountingPage() {
  const today = todayExpenseDate();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const { state, refetch } = useAccountingSnapshotQuery({ dateFrom, dateTo });
  const syncMutation = useSyncAccountingJournalsMutation();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onSync = async () => {
    setError(null);
    setMessage(null);
    try {
      const result = await syncMutation.mutateAsync({ dateFrom, dateTo });
      setMessage(
        `Posted ${result.posted} new journal(s); ${result.skipped} already existed.`,
      );
      await refetch();
    } catch (err) {
      setError(formatMutationError(err, 'Could not sync books'));
    }
  };

  return (
    <div className="ga-accounting">
      <PageHeader
        title="Books"
        subtitle="Balanced journals built from sales, collections, purchases, and expenses"
        meta={`${dateFrom} → ${dateTo}`}
      />

      <SectionRelatedLinks
        label="Money"
        links={[...ACCOUNTING_SECTION_LINKS]}
      />

      <div className="ga-accounting__toolbar">
        <label>
          <span className="ga-sr-only">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label>
          <span className="ga-sr-only">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
        <Button
          variant="primary"
          disabled={syncMutation.isPending}
          onClick={() => void onSync()}
        >
          {syncMutation.isPending ? 'Updating books…' : 'Update books'}
        </Button>
      </div>

      {error ? <p className="ga-accounting__error">{error}</p> : null}
      {message ? <p className="ga-accounting__note">{message}</p> : null}

      <QueryStateGate title="Books" state={state}>
        {(snapshot) => (
          <>
            <KpiCards
              items={[
                {
                  id: 'accounts',
                  label: 'Accounts',
                  value: String(snapshot.accountCount),
                  hint: 'Chart of accounts',
                },
                {
                  id: 'journals',
                  label: 'Journals in range',
                  value: String(snapshot.journalCount),
                },
                {
                  id: 'debits',
                  label: 'Trial balance debits',
                  value: snapshot.totalDebitsLabel,
                },
                {
                  id: 'credits',
                  label: 'Trial balance credits',
                  value: snapshot.totalCreditsLabel,
                  tone: snapshot.trialBalanceBalanced ? 'positive' : 'danger',
                  hint: snapshot.trialBalanceBalanced
                    ? 'Debits = credits'
                    : 'Out of balance',
                },
              ]}
            />

            <p className="ga-accounting__note">
              Books stay in sync with business activity. Updating does not create
              a second set of payments — it posts balanced journals from existing
              sales, collections, stock receipts, supplier payments, expenses, and
              paid payroll.
            </p>

            <section className="ga-accounting__card">
              <h2>Chart of accounts</h2>
              <div className="ga-table-wrap">
                <table className="ga-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.accounts.map((account) => (
                      <tr key={account.id}>
                        <td className="ga-table__mono">{account.code}</td>
                        <td>{account.name}</td>
                        <td>{account.accountTypeLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="ga-accounting__card">
              <h2>Journals</h2>
              {snapshot.journals.length === 0 ? (
                <EmptyState
                  title="No journals in this range"
                  detail="Choose dates and tap Update books to post from business activity."
                />
              ) : (
                <div className="ga-table-wrap">
                  <table className="ga-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Memo</th>
                        <th>Amount</th>
                        <th>Lines</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.journals.map((journal) => (
                        <tr key={journal.id}>
                          <td>{journal.entryDateLabel}</td>
                          <td>{journal.sourceTypeLabel}</td>
                          <td>{journal.memo}</td>
                          <td>{journal.totalDebitLabel}</td>
                          <td>{journal.lineCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="ga-accounting__card">
              <h2>Trial balance</h2>
              {snapshot.trialBalance.length === 0 ? (
                <EmptyState
                  title="No trial balance yet"
                  detail="Post journals for this range to see account balances."
                />
              ) : (
                <div className="ga-table-wrap">
                  <table className="ga-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Account</th>
                        <th>Type</th>
                        <th>Debit</th>
                        <th>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.trialBalance.map((row) => (
                        <tr key={row.accountId}>
                          <td className="ga-table__mono">{row.code}</td>
                          <td>{row.name}</td>
                          <td>{row.accountTypeLabel}</td>
                          <td>{row.balanceDebitLabel}</td>
                          <td>{row.balanceCreditLabel}</td>
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
