import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import type { DeliverySetupGuidance } from '@/data/delivery-setup-helpers';
import './OrderDeliverySetupBanner.css';

type Props = {
  guidance: DeliverySetupGuidance;
  onAssignTrip?: () => void;
  onAddDriver?: () => void;
};

export function OrderDeliverySetupBanner({
  guidance,
  onAssignTrip,
  onAddDriver,
}: Props) {
  return (
    <div className="ga-ord-setup" role="status">
      <p className="ga-ord-setup__ok">✅ Order packed successfully.</p>
      <p className="ga-ord-setup__warn">⚠️ {guidance.title}</p>
      <p className="ga-ord-setup__msg">{guidance.message}</p>
      <div className="ga-ord-setup__actions">
        {guidance.showAddDriver ? (
          onAddDriver ? (
            <Button variant="secondary" onClick={onAddDriver}>
              ➕ Add Delivery Boy
            </Button>
          ) : (
            <Link to="/delivery/boys" className="ga-ord-setup__link">
              ➕ Add Delivery Boy
            </Link>
          )
        ) : null}
        {guidance.showAddVehicle ? (
          <Link to="/delivery/vehicles" className="ga-ord-setup__link">
            🚐 Add Vehicle
          </Link>
        ) : null}
        {guidance.showAssignTrip && onAssignTrip ? (
          <Button variant="primary" onClick={onAssignTrip}>
            🚚 Assign Delivery
          </Button>
        ) : null}
      </div>
    </div>
  );
}
