import { Link } from 'react-router-dom';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryStateGate } from '@/data/QueryStateGate';
import { useDailyBusinessBriefSnapshotQuery } from '@/data/hooks';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import './DailyBriefPage.css';

export function DailyBriefPage() {
  const { state } = useDailyBusinessBriefSnapshotQuery();

  return (
    <div className="ga-daily-brief">
      <PageHeader
        title="Today's brief"
        subtitle="Yesterday’s money, what needs attention, and what to do next — from your books."
      />
      <SectionRelatedLinks links={[...ACCOUNTING_SECTION_LINKS]} />

      <QueryStateGate title="Today's brief" state={state}>
        {(data) => (
          <>
            <header className="ga-daily-brief__hero">
              <h2 className="ga-daily-brief__greeting">{data.greeting}</h2>
              <p className="ga-daily-brief__meta">
                As of {data.asOfLabel} · focusing on {data.yesterdayDateLabel}
              </p>
              <p className="ga-daily-brief__honesty">{data.honestyNote}</p>
            </header>

            {data.yesterday ? (
              <section className="ga-daily-brief__section" aria-label="Yesterday">
                <h3 className="ga-daily-brief__section-title">Yesterday</h3>
                <p className="ga-daily-brief__section-meta">
                  {data.yesterday.rangeLabel}
                </p>
                <dl className="ga-daily-brief__metrics">
                  <div>
                    <dt>Sales</dt>
                    <dd>{data.yesterday.salesTotalLabel}</dd>
                  </div>
                  <div>
                    <dt>Collected</dt>
                    <dd>{data.yesterday.collectionsTotalLabel}</dd>
                  </div>
                  <div>
                    <dt>Expenses</dt>
                    <dd>{data.yesterday.expensesTotalLabel}</dd>
                  </div>
                  <div>
                    <dt>Gross profit</dt>
                    <dd>
                      {data.yesterday.grossProfitLabel}
                      <span className="ga-daily-brief__muted">
                        {' '}
                        · margin {data.yesterday.grossMarginLabel}
                      </span>
                    </dd>
                  </div>
                </dl>
                <Link to="/reports/profit-loss" className="ga-daily-brief__link">
                  Open Profit &amp; Loss →
                </Link>
              </section>
            ) : null}

            <section className="ga-daily-brief__section" aria-label="Attention">
              <h3 className="ga-daily-brief__section-title">Attention</h3>
              {data.attention.length === 0 ? (
                <EmptyState
                  title="Nothing flagged"
                  detail="No open dues, stock, or draft items under the current rules."
                />
              ) : (
                <ul className="ga-daily-brief__list">
                  {data.attention.map((item) => (
                    <li key={item.id} className="ga-daily-brief__item">
                      <div className="ga-daily-brief__item-title">
                        <strong>{item.count}</strong> {item.title}
                      </div>
                      <div className="ga-daily-brief__item-detail">
                        {item.detail}
                      </div>
                      <Link to={item.href}>Open →</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className="ga-daily-brief__section"
              aria-label="Recommendations"
            >
              <h3 className="ga-daily-brief__section-title">Recommendation</h3>
              {data.recommendations.length === 0 ? (
                <EmptyState
                  title="No recommendations right now"
                  detail="Books look quiet — check back after more sales or dues activity."
                />
              ) : (
                <ul className="ga-daily-brief__list">
                  {data.recommendations.map((rec) => (
                    <li key={rec.id} className="ga-daily-brief__item">
                      <div className="ga-daily-brief__item-title">
                        {rec.title}
                      </div>
                      <div className="ga-daily-brief__item-detail">
                        {rec.detail}
                      </div>
                      <Link to={rec.href}>Go →</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="ga-daily-brief__footer">
              <Link to="/">Dashboard</Link>
              {' · '}
              <Link to="/dues">Dues</Link>
              {' · '}
              <Link to="/purchases/recommend">What to buy</Link>
              {' · '}
              <Link to="/reports/profit-insights">Profit insights</Link>
            </p>
          </>
        )}
      </QueryStateGate>
    </div>
  );
}
