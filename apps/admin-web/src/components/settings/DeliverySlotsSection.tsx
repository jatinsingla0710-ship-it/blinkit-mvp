import type { DeliverySlotRow } from '@/data/settings-types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import './DeliverySlotsSection.css';

type Props = {
  slots: DeliverySlotRow[];
};

export function DeliverySlotsSection({ slots }: Props) {
  return (
    <div className="ga-st-slots">
      {slots.map((slot) => (
        <Card key={slot.id}>
          <div className="ga-st-slots__header">
            <p className="ga-st-slots__name">{slot.name}</p>
            <Badge tone={slot.enabled ? 'success' : 'neutral'}>
              {slot.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <p className="ga-st-slots__window">{slot.windowLabel}</p>
          <p className="ga-st-slots__kind">{slot.kind}</p>
        </Card>
      ))}
    </div>
  );
}
