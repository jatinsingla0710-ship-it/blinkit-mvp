import type {
  SalesmanCollectionRow,
  SalesmanCollectionSummary,
  SalesmanPerformance,
} from '@/data/salesmen-types';
import { SalesmanCollectionsTab } from '@/components/salesmen/SalesmanCollectionsTab';
import { Card } from '@/components/ui/Card';
import './SalesmanPerformanceTab.css';

type Props = {
  performance: SalesmanPerformance;
  collections?: SalesmanCollectionSummary;
  collectionHistory?: SalesmanCollectionRow[];
};

function metric(
  label: string,
  value: string | number | undefined,
  hint?: string,
) {
  const display =
    value === undefined || value === null || value === ''
      ? 'Not available'
      : String(value);
  return { label, value: display, hint };
}

export function SalesmanPerformanceTab({
  performance,
  collections,
  collectionHistory,
}: Props) {
  const cards = [
    metric('Orders This Month', performance.ordersThisMonth, 'Calendar month'),
    metric(
      'Revenue This Month',
      performance.revenueGeneratedLabel,
      'Calendar month · same window as orders',
    ),
    metric('New Customers', performance.newCustomers),
    metric('Repeat Customers', performance.repeatCustomers),
    metric(
      'Avg Order Value (This Month)',
      performance.averageOrderValueLabel,
      'Revenue ÷ orders this month',
    ),
    metric(
      'Visits Completed',
      performance.visitsCompletedThisMonth,
      'Calendar month',
    ),
    metric(
      'Visits Missed',
      performance.visitsMissedThisMonth,
      'Calendar month',
    ),
    metric(
      'Customers Visited',
      performance.customersVisitedThisMonth,
      'Distinct shops visited this month',
    ),
    metric(
      'Collections',
      performance.collectionsLabel,
      'COD + online this month when available',
    ),
  ];

  return (
    <div className="ga-sm-perf-wrap">
      <div className="ga-sm-perf">
        {cards.map((card) => (
          <Card key={card.label}>
            <p className="ga-sm-perf__label">{card.label}</p>
            <p className="ga-sm-perf__value">{card.value}</p>
            {card.hint ? (
              <p className="ga-sm-perf__hint">{card.hint}</p>
            ) : null}
          </Card>
        ))}
      </div>

      {collections ? (
        <section className="ga-sm-perf__collections">
          <h3 className="ga-sm-perf__section-title">Collections</h3>
          <SalesmanCollectionsTab
            summary={collections}
            history={collectionHistory ?? []}
          />
        </section>
      ) : null}
    </div>
  );
}
