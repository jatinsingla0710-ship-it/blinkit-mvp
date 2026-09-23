import type { DeliveryVehicleInfo } from '@/data/delivery-types';
import { VehicleStatusBadge } from '@/components/delivery/DeliveryStatusBadges';
import './DeliveryVehicleTab.css';

type Props = {
  vehicle: DeliveryVehicleInfo;
};

export function DeliveryVehicleTab({ vehicle }: Props) {
  return (
    <dl className="ga-dl-vehicle">
      <div>
        <dt>Vehicle Number</dt>
        <dd>{vehicle.vehicleNumber}</dd>
      </div>
      <div>
        <dt>Driver</dt>
        <dd>{vehicle.driverName}</dd>
      </div>
      <div>
        <dt>Capacity</dt>
        <dd>{vehicle.capacityLabel}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>
          <VehicleStatusBadge status={vehicle.status} />
        </dd>
      </div>
    </dl>
  );
}
