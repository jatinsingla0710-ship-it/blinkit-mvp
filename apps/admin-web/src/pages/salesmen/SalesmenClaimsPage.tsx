import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@groaurum/ui';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { requireLiveAdminApi } from '@/data/adminDataClient';
import { formatMutationError } from '@/data/mutation-errors';
import { TEAM_SECTION_LINKS } from '@/data/section-links';
import './SalesmenClaimsPage.css';

/**
 * Team pending claims inbox — approve/reject still happens on the salesman Claims tab.
 * Approval records a decision only; it does not pay the salesman.
 */
export function SalesmenClaimsPage() {
  const pending = useQuery({
    queryKey: ['groaurum', 'salesmen', 'claims', 'pending-inbox'],
    queryFn: () => requireLiveAdminApi().listPendingTeamClaims(),
  });

  const rows = pending.data ?? [];

  return (
    <div className="ga-sm-claims-page">
      <PageHeader
        title="Pending claims"
        subtitle="Team expense and return requests waiting for review"
        meta={
          pending.isPending
            ? 'Loading…'
            : `${rows.length} pending · approve does not pay`
        }
      />

      <SectionRelatedLinks label="Team section" links={[...TEAM_SECTION_LINKS]} />

      <p className="ga-sm-claims-page__note">
        Open a claim to approve or reject on the salesman detail page. Company
        Expenses (Accounting) are separate from salesman claims.
      </p>

      {pending.isError ? (
        <p className="ga-sm-claims-page__error" role="alert">
          {formatMutationError(pending.error, 'Could not load pending claims')}
        </p>
      ) : null}

      {pending.isPending ? (
        <p className="ga-sm-claims-page__note">Loading pending claims…</p>
      ) : null}

      {!pending.isPending && rows.length === 0 ? (
        <EmptyState
          title="No pending claims"
          detail="New expense and return requests from Sales will appear here."
        />
      ) : null}

      <ul className="ga-sm-claims-page__list">
        {rows.map((row) => (
          <li key={`${row.kind}-${row.id}`}>
            <Link to={row.href} className="ga-sm-claims-page__card">
              <div className="ga-sm-claims-page__row">
                <strong>{row.salesmanName}</strong>
                <Badge tone="warning">
                  {row.kind === 'expense' ? 'Expense' : 'Return'}
                </Badge>
              </div>
              <p className="ga-sm-claims-page__title">{row.title}</p>
              <p className="ga-sm-claims-page__detail">{row.detail}</p>
              <div className="ga-sm-claims-page__row">
                <span>{row.createdAtLabel}</span>
                {row.amountLabel ? <strong>{row.amountLabel}</strong> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
