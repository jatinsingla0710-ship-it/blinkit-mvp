import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import {
  getDuesAnswer,
  type DuesQuestionId,
  type DuesPriorityRow,
} from '@/data/dues-assistant';
import { useDuesAssistantSnapshotQuery } from '@/data/hooks';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import '@groaurum/ui/styles/data-table.css';
import '../receivables/ReceivablesPage.css';
import './DuesAssistantPage.css';

function DuesTable({ rows }: { rows: DuesPriorityRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Party</th>
            <th>Due</th>
            <th>Age</th>
            <th>Why listed</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.kind}-${row.id}`}>
              <td>
                <Link to={row.href}>{row.name}</Link>
                <div className="ga-receivables__meta">
                  {row.kind === 'customer' ? 'Customer' : 'Supplier'}
                  {row.meta ? ` · ${row.meta}` : ''}
                </div>
              </td>
              <td>
                <strong className="ga-receivables__due">
                  {row.outstandingLabel}
                </strong>
              </td>
              <td>
                {row.ageDays != null ? (
                  <>
                    {row.ageingLabel}
                    <div className="ga-receivables__meta">
                      {row.ageDays} day{row.ageDays === 1 ? '' : 's'}
                    </div>
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td>{row.reason}</td>
              <td className="ga-receivables__actions">
                <Link to={row.href}>Open</Link>
                {row.actionHref && row.actionLabel ? (
                  <>
                    {' · '}
                    <Link to={row.actionHref}>{row.actionLabel}</Link>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DuesAssistantPage() {
  const { state } = useDuesAssistantSnapshotQuery();
  const [questionId, setQuestionId] = useState<DuesQuestionId>('who_owes_me');

  const answer = useMemo(() => {
    if (!state.data) return null;
    return getDuesAnswer(state.data, questionId);
  }, [state.data, questionId]);

  return (
    <div className="ga-receivables ga-dues">
      <PageHeader
        title="Dues assistant"
        description="Ask who owes you or whom you need to pay — answered from your books with ranking rules, not AI guesses."
      />
      <SectionRelatedLinks links={ACCOUNTING_SECTION_LINKS} />

      <QueryStateGate
        state={state}
        emptyTitle="No open dues"
        emptyDetail="Customer and supplier balances are clear on the books."
      >
        {(data) => (
          <>
            <div className="ga-dues__summary">
              <div>
                <div className="ga-dues__summary-label">Customers due</div>
                <div className="ga-dues__summary-value">
                  {data.receivablesTotalLabel}
                </div>
                <div className="ga-receivables__meta">
                  {data.customersWithDues} open
                </div>
              </div>
              <div>
                <div className="ga-dues__summary-label">Suppliers to pay</div>
                <div className="ga-dues__summary-value">
                  {data.payablesTotalLabel}
                </div>
                <div className="ga-receivables__meta">
                  {data.suppliersWithDues} open
                </div>
              </div>
              <div className="ga-receivables__meta ga-dues__as-of">
                As of {data.generatedAtLabel}
              </div>
            </div>

            <div className="ga-dues__questions" role="tablist" aria-label="Dues questions">
              {data.questions.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  role="tab"
                  aria-selected={questionId === q.id}
                  className={
                    questionId === q.id
                      ? 'ga-receivables__chip ga-receivables__chip--active'
                      : 'ga-receivables__chip'
                  }
                  onClick={() => setQuestionId(q.id)}
                >
                  {q.label}
                </button>
              ))}
            </div>

            {answer ? (
              <section className="ga-dues__answer" aria-live="polite">
                <h2 className="ga-dues__answer-title">{answer.title}</h2>
                <p className="ga-dues__answer-summary">{answer.summary}</p>
                <p className="ga-dues__honesty">{answer.honestyNote}</p>
                {answer.rows.length === 0 ? (
                  <EmptyState
                    title={answer.emptyTitle}
                    detail={answer.emptyDetail}
                  />
                ) : (
                  <DuesTable rows={answer.rows} />
                )}
              </section>
            ) : null}

            <p className="ga-dues__footer-links">
              Full lists:{' '}
              <Link to="/receivables">Money Due</Link>
              {' · '}
              <Link to="/payables">Money to Pay</Link>
            </p>
          </>
        )}
      </QueryStateGate>
    </div>
  );
}
