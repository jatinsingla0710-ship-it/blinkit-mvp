import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import type { CustomerDetail } from '@/data/customers-types';
import {
  CustomerStatusBadge,
  DigitalAccessBadge,
} from '@/components/customers/CustomerStatusBadges';
import { customerInitials } from '@/data/customer-account-dashboard';
import './CustomerAccountHeader.css';

type Props = {
  customer: CustomerDetail;
  canManage: boolean;
  onEdit: () => void;
  onSendAppLink: () => void;
  onReassign: () => void;
  sendingAppLink?: boolean;
};

export function CustomerAccountHeader({
  customer,
  canManage,
  onEdit,
  onSendAppLink,
  onReassign,
  sendingAppLink,
}: Props) {
  const locationLabel = [customer.areaLabel, customer.deliveryCity, customer.deliveryState]
    .filter((part) => part && part !== '—')
    .join(', ');

  return (
    <header className="ga-cust-account-header">
      <div className="ga-cust-account-header__main">
        <Link to="/customers" className="ga-cust-account-header__back">
          ← Customers
        </Link>
        <div className="ga-cust-account-header__identity">
          <div
            className="ga-cust-account-header__avatar"
            aria-hidden
          >
            {customerInitials(customer.shopName, customer.ownerName)}
          </div>
          <div>
            <h1 className="ga-cust-account-header__title">{customer.shopName}</h1>
            <p className="ga-cust-account-header__owner">{customer.ownerName}</p>
            <div className="ga-cust-account-header__meta">
              {customer.phoneLabel !== '—' ? (
                <span>📱 {customer.phoneLabel}</span>
              ) : null}
              {locationLabel ? <span>📍 {locationLabel}</span> : null}
            </div>
            <div className="ga-cust-account-header__badges">
              <CustomerStatusBadge status={customer.status} />
              <DigitalAccessBadge
                status={customer.digitalAccess}
                label={customer.digitalAccessVm.label}
              />
            </div>
          </div>
        </div>
      </div>

      {canManage ? (
        <div className="ga-cust-account-header__actions">
          {customer.digitalAccess !== 'activated' &&
          customer.digitalAccess !== 'access_disabled' ? (
            <Button
              variant="primary"
              disabled={sendingAppLink || customer.phoneLabel === '—'}
              onClick={onSendAppLink}
            >
              {sendingAppLink ? 'Recording…' : 'Send App Link'}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onEdit}>
            Edit Customer
          </Button>
          <Button variant="ghost" onClick={onReassign}>
            Reassign Salesman
          </Button>
        </div>
      ) : null}
    </header>
  );
}
