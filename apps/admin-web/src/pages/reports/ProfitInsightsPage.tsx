import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import {
  getProfitInsightAnswer,
  type ProfitInsightFinding,
  type ProfitInsightQuestionId,
} from '@/data/profit-anomaly-assistant';
import { useProfitAnomalyAssistantSnapshotQuery } from '@/data/hooks';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import '@groaurum/ui/styles/data-table.css';
import '../receivables/ReceivablesPage.css';
import './ProfitInsightsPage.css';

function severityClass(severity: ProfitInsightFinding['severity']): string {
  if (severity === 'attention') return 'ga-profit-insights__finding--attention';
  if (severity === 'watch') return 'ga-profit-insights__finding--watch';
  return 'ga-profit-insights__finding--info';
}

function FindingsList({ findings }: { findings: ProfitInsightFinding[] }) {
  if (findings.length === 0) return null;
  return (
    <ul className="ga-profit-insights__list">
      {findings.map((finding) => (
        <li
          key={finding.id}
          className={`ga-profit-insights__finding ${severityClass(finding.severity)}`}
        >
          <div className="ga-profit-insights__finding-title">{finding.title}</div>
          <div className="ga-profit-insights__finding-detail">{finding.detail}</div>
          {finding.href ? (
            <Link to={finding.href} className="ga-profit-insights__finding-link">
              Open related
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ProfitInsightsPage() {
  const { state } = useProfitAnomalyAssistantSnapshotQuery();
  const [questionId, setQuestionId] =
    useState<ProfitInsightQuestionId>('why_profit_changed');

  const answer = useMemo(() => {
    if (!state.data) return null;
    return getProfitInsightAnswer(state.data, questionId);
  }, [state.data, questionId]);

  return (
    <div className="ga-receivables ga-profit-insights">
      <PageHeader
        title="Profit insights"
        subtitle="Why profit changed this month vs last month, and what stands out — from your books, not AI guesses."
      />
      <SectionRelatedLinks links={[...ACCOUNTING_SECTION_LINKS]} />

      <QueryStateGate title="Profit insights" state={state}>
        {(data) => (
          <>
            <div className="ga-profit-insights__summary">
              <div>
                <div className="ga-profit-insights__summary-label">
                  This month operating
                </div>
                <div className="ga-profit-insights__summary-value">
                  {data.current.operatingResultLabel}
                </div>
                <div className="ga-receivables__meta">
                  Margin {data.current.grossMarginLabel}
                </div>
              </div>
              <div>
                <div className="ga-profit-insights__summary-label">
                  Last month operating
                </div>
                <div className="ga-profit-insights__summary-value">
                  {data.prior.operatingResultLabel}
                </div>
                <div className="ga-receivables__meta">
                  Margin {data.prior.grossMarginLabel}
                </div>
              </div>
              <div className="ga-receivables__meta ga-profit-insights__as-of">
                {data.currentRangeLabel} vs {data.priorRangeLabel} · as of{' '}
                {data.generatedAtLabel}
              </div>
            </div>

            <div
              className="ga-receivables__filters"
              role="tablist"
              aria-label="Profit questions"
            >
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
              <section className="ga-profit-insights__answer" aria-live="polite">
                <h2 className="ga-profit-insights__answer-title">{answer.title}</h2>
                <p className="ga-profit-insights__answer-summary">
                  {answer.summary}
                </p>
                <p className="ga-profit-insights__honesty">{answer.honestyNote}</p>
                {answer.findings.length === 0 ? (
                  <EmptyState
                    title={answer.emptyTitle}
                    detail={answer.emptyDetail}
                  />
                ) : (
                  <FindingsList findings={answer.findings} />
                )}
              </section>
            ) : null}

            <p className="ga-profit-insights__footer">
              <Link to="/reports/profit-loss">Profit &amp; Loss</Link>
              {' · '}
              <Link to="/expenses">Expenses</Link>
              {' · '}
              <Link to="/reports">All reports</Link>
            </p>
          </>
        )}
      </QueryStateGate>
    </div>
  );
}
