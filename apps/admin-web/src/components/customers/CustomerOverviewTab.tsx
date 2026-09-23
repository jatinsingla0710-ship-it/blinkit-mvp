import type { CustomerDetail } from '@/data/customers-types';
import {
  CustomerStatusBadge,
  PreferredPaymentBadge,
} from '@/components/customers/CustomerStatusBadges';
import { CustomerShopLocationPanel } from '@/components/customers/CustomerShopLocationPanel';
import {
  buildGoogleMapsDirectionsUrl,
  formatCoordinates,
  isValidCoordinatePair,
} from '@/data/geolocation';
import './CustomerOverviewTab.css';

type Props = {
  customer: CustomerDetail;
};

export function CustomerOverviewTab({ customer }: Props) {
  const hasLocation = isValidCoordinatePair(
    customer.deliveryLat,
    customer.deliveryLng,
  );

  return (
    <div className="ga-cust-overview">
      <dl className="ga-cust-overview__grid">
        <div>
          <dt>Owner</dt>
          <dd>{customer.ownerName}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{customer.phoneLabel}</dd>
        </div>
        <div>
          <dt>Area</dt>
          <dd>{customer.areaLabel}</dd>
        </div>
        <div>
          <dt>Assigned salesman</dt>
          <dd>{customer.salesmanName}</dd>
        </div>
        <div>
          <dt>Customer class</dt>
          <dd>{customer.orderClassLabel}</dd>
        </div>
        <div>
          <dt>Preferred payment</dt>
          <dd>
            <PreferredPaymentBadge payment={customer.preferredPayment} />
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <CustomerStatusBadge status={customer.status} />
          </dd>
        </div>
        <div>
          <dt>Shop location</dt>
          <dd>
            {hasLocation ? (
              <>
                {formatCoordinates(customer.deliveryLat!, customer.deliveryLng!)}
                {' · '}
                <a
                  className="ga-cust-overview__maps-link"
                  href={buildGoogleMapsDirectionsUrl(
                    customer.deliveryLat!,
                    customer.deliveryLng!,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Navigate to Shop
                </a>
              </>
            ) : (
              'Not captured'
            )}
          </dd>
        </div>
        {customer.hasPendingInvitation ? (
          <div>
            <dt>Pending invitation token</dt>
            <dd>
              Active until {customer.pendingInvitationExpiresAtLabel ?? '—'}{' '}
              (share manually — not sent via SMS/email)
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Created</dt>
          <dd>{customer.createdAtLabel}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{customer.updatedAtLabel}</dd>
        </div>
      </dl>

      <CustomerShopLocationPanel
        customerId={customer.id}
        deliveryLat={customer.deliveryLat}
        deliveryLng={customer.deliveryLng}
      />
    </div>
  );
}
