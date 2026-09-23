import type { DeliveryRouteDetail } from '@/data/delivery-types';
import { RouteStatusBadge } from '@/components/delivery/DeliveryStatusBadges';
import { Field, FieldGrid } from '@groaurum/ui';

type Props = {
  route: DeliveryRouteDetail;
};

/** Overview shows schema-backed fields only (no invented vehicle/warehouse). */
export function DeliveryOverviewTab({ route }: Props) {
  return (
    <FieldGrid columns={4}>
      <Field label="Route Number">{route.routeNumberLabel}</Field>
      <Field label="Driver">{route.driverName}</Field>
      <Field label="Delivery Area">{route.deliveryArea}</Field>
      <Field label="Status">
        <RouteStatusBadge status={route.status} />
      </Field>
    </FieldGrid>
  );
}
