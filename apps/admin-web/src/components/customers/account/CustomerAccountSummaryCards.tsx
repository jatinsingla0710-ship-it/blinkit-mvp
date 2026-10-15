import type { CustomerOpeningBalanceVm } from '@/data/customers-types';
import './CustomerAccountSummaryCards.css';

type Props = {
  totalSalesLabel: string;
  totalPaidLabel: string;
  outstandingLabel: string;
  outstanding: number;
  openingBalance?: CustomerOpeningBalanceVm | null;
};

/**
 * Owner-facing money snapshot — Outstanding is the strongest signal.
 * Values come from the customer ledger builder (server-derived inputs).
 */
export function CustomerAccountSummaryCards({
  totalSalesLabel,
  totalPaidLabel,
  outstandingLabel,
  outstanding,
  openingBalance,
}: Props) {
  return (
    <div className="ga-cust-account-kpis" aria-label="Customer money summary">
      <div
        className={[
          'ga-cust-account-kpi',
          'ga-cust-account-kpi--outstanding',
          outstanding > 0 ? 'ga-cust-account-kpi--warning' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="ga-cust-account-kpi__label">Outstanding</span>
        <span className="ga-cust-account-kpi__value ga-cust-account-kpi__value--hero">
          {outstandingLabel}
        </span>
        <span className="ga-cust-account-kpi__hint">
          {outstanding > 0 ? 'Still due from this customer' : 'Nothing due'}
        </span>
      </div>

      <div className="ga-cust-account-kpis__money">
        <div className="ga-cust-account-kpi">
          <span className="ga-cust-account-kpi__label">Sales</span>
          <span className="ga-cust-account-kpi__value">{totalSalesLabel}</span>
        </div>
        <div className="ga-cust-account-kpi ga-cust-account-kpi--positive">
          <span className="ga-cust-account-kpi__label">Paid</span>
          <span className="ga-cust-account-kpi__value">{totalPaidLabel}</span>
        </div>
        {openingBalance ? (
          <div className="ga-cust-account-kpi">
            <span className="ga-cust-account-kpi__label">Opening balance</span>
            <span className="ga-cust-account-kpi__value">
              {openingBalance.amountLabel}
            </span>
            <span className="ga-cust-account-kpi__hint">
              As of {openingBalance.asOfDateLabel}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
