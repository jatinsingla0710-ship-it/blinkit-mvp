import type { CustomerDetail } from '@/data/customers-types';
import {
  CustomerStatusBadge,
  PreferredPaymentBadge,
} from '@/components/customers/CustomerStatusBadges';
import { Card } from '@/components/ui/Card';
import './CustomerAccountSections.css';

type Props = {
  customer: CustomerDetail;
  onEdit: () => void;
  canManage: boolean;
};

export function CustomerAccountBusinessInfo({
  customer,
  onEdit,
  canManage,
}: Props) {
  const addressParts = [
    customer.deliveryAddressLine,
    customer.deliveryCity,
    customer.deliveryState,
    customer.deliveryPinCode,
  ].filter(Boolean);

  return (
    <Card title="Contact & Business" className="ga-cust-account-card">
      <section className="ga-cust-account-info-block">
        <h3>Contact</h3>
        <dl>
          <div>
            <dt>Primary contact</dt>
            <dd>{customer.ownerName}</dd>
          </div>
          <div>
            <dt>Mobile</dt>
            <dd>{customer.phoneLabel}</dd>
          </div>
          {customer.emailLabel ? (
            <div>
              <dt>Email</dt>
              <dd>{customer.emailLabel}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="ga-cust-account-info-block">
        <h3>Address</h3>
        <dl>
          <div>
            <dt>Shop address</dt>
            <dd>{addressParts.length ? addressParts.join(', ') : '—'}</dd>
          </div>
          <div>
            <dt>Area</dt>
            <dd>{customer.areaLabel}</dd>
          </div>
        </dl>
      </section>

      <section className="ga-cust-account-info-block">
        <h3>Business information</h3>
        <dl>
          <div>
            <dt>Business status</dt>
            <dd>
              <CustomerStatusBadge status={customer.status} />
            </dd>
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
            <dt>Created</dt>
            <dd>{customer.createdAtLabel}</dd>
          </div>
        </dl>
      </section>

      {canManage ? (
        <button
          type="button"
          className="ga-cust-account-link ga-cust-account-link--button"
          onClick={onEdit}
        >
          Edit customer
        </button>
      ) : null}
    </Card>
  );
}
