import type { DeliveryTimelineStage } from '@/data/delivery-types';
import { EmptyState, Timeline } from '@groaurum/ui';

type Props = {
  stages: DeliveryTimelineStage[];
};

export function DeliveryTimelineTab({ stages }: Props) {
  return (
    <Timeline
      items={stages.map((stage) => ({
        id: stage.id,
        title: stage.label,
        meta: stage.atLabel,
        note: stage.note,
        state: stage.state,
      }))}
      empty={
        <EmptyState
          title="No timeline"
          detail="Route execution stages will appear here."
        />
      }
    />
  );
}
