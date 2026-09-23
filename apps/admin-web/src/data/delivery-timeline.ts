import type {
  DeliveryTimelineStage,
  RouteStatus,
  TimelineStageState,
} from '@/data/delivery-types';

export type DeliveryTimelineStopEvent = {
  id: string;
  label: string;
  atIso: string;
  note?: string;
};

/**
 * Honest route timeline from real timestamps only.
 * Does not invent vehicle_loaded / departed_warehouse stages.
 */
export function buildDeliveryRouteTimeline(input: {
  routeStatus: RouteStatus;
  createdAtIso: string;
  updatedAtIso: string;
  /** Earliest order_events.created_at for route-start / OUT_FOR_DELIVERY. */
  routeStartedAtIso: string | null;
  formatDateTime: (iso: string) => string;
  stopEvents: DeliveryTimelineStopEvent[];
}): DeliveryTimelineStage[] {
  const {
    routeStatus,
    createdAtIso,
    updatedAtIso,
    routeStartedAtIso,
    formatDateTime,
    stopEvents,
  } = input;

  const started =
    routeStatus === 'running' ||
    routeStatus === 'completed' ||
    routeStatus === 'cancelled' ||
    Boolean(routeStartedAtIso);

  let startedState: TimelineStageState = 'upcoming';
  if (started) {
    startedState =
      routeStatus === 'running' && stopEvents.length === 0 ? 'current' : 'done';
  }

  const stages: DeliveryTimelineStage[] = [
    {
      id: 'route_created',
      label: 'Route Created',
      atLabel: formatDateTime(createdAtIso),
      state: 'done',
    },
    {
      id: 'route_started',
      label: 'Route Started',
      atLabel: routeStartedAtIso
        ? formatDateTime(routeStartedAtIso)
        : undefined,
      state: startedState,
      note:
        started && !routeStartedAtIso
          ? 'In progress (start time not recorded on route)'
          : undefined,
    },
  ];

  const sortedStops = [...stopEvents].sort((a, b) =>
    a.atIso.localeCompare(b.atIso),
  );
  for (const ev of sortedStops) {
    stages.push({
      id: ev.id,
      label: ev.label,
      atLabel: formatDateTime(ev.atIso),
      state: 'done',
      note: ev.note,
    });
  }

  if (routeStatus === 'completed') {
    stages.push({
      id: 'route_completed',
      label: 'Route Completed',
      atLabel: formatDateTime(updatedAtIso),
      state: 'done',
      note: 'Uses route updated_at (no separate closed_at column)',
    });
  } else if (routeStatus === 'cancelled') {
    stages.push({
      id: 'route_cancelled',
      label: 'Route Cancelled',
      atLabel: formatDateTime(updatedAtIso),
      state: 'skipped',
    });
  } else {
    stages.push({
      id: 'route_completed',
      label: 'Route Completed',
      state: 'upcoming',
    });
  }

  return stages;
}
