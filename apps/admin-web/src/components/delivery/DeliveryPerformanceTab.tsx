import type { DeliveryPerformance } from '@/data/delivery-types';
import { Card } from '@/components/ui/Card';
import './DeliveryPerformanceTab.css';

type Props = {
  performance: DeliveryPerformance;
};

/** Only metrics derived from live stop statuses — no fake rating/time. */
export function DeliveryPerformanceTab({ performance }: Props) {
  const cards = [
    {
      label: 'Orders Delivered',
      value: String(performance.ordersDelivered),
    },
    {
      label: 'Delivery Success Rate',
      value: performance.deliverySuccessRateLabel,
    },
    {
      label: 'Failed Deliveries',
      value: String(performance.failedDeliveries),
    },
  ];

  return (
    <div className="ga-dl-perf">
      {cards.map((card) => (
        <Card key={card.label}>
          <p className="ga-dl-perf__label">{card.label}</p>
          <p className="ga-dl-perf__value">{card.value}</p>
        </Card>
      ))}
    </div>
  );
}
