import { Link } from 'react-router-dom';
import { Button } from '@groaurum/ui';
import type { CustomerDetail } from '@/data/customers-types';
import { CustomerStatusBadge } from '@/components/customers/CustomerStatusBadges';
import { customerInitials } from '@/data/customer-account-dashboard';
import './CustomerAccountHeader.css';

type Props = {
  customer: CustomerDetail;
  canManage: boolean;
  onEdit: () => void;
  onReassign: () => void;
  onArchive?: () => void;
};

export function CustomerAccountHeader({
  customer,
  canManage,
  onEdit,
  onReassign,
  onArchive,
}: Props) {
  const addressBits = [
    customer.deliveryAddressLine,
    customer.deliveryCity,
    customer.deliveryState,
    customer.deliveryPinCode,
  ].filter(Boolean);
  const locationLabel =
    addressBits.length > 0
      ? addressBits.join(', ')
      : [customer.areaLabel].filter((part) => part && part !== '—').join(', ');

  return (
    <header className="ga-cust-account-header">
      <div className="ga-cust-account-header__main">
        <Link to="/customers" className="ga-cust-account-header__back">
          ← Customers
        </Link>
        <div className="ga-cust-account-header__identity">
          <div className="ga-cust-account-header__avatar" aria-hidden>
            {customerInitials(customer.shopName, customer.ownerName)}
          </div>
          <div>
            <h1 className="ga-cust-account-header__title">{customer.shopName}</h1>
            <p className="ga-cust-account-header__owner">
              {customer.ownerName !== '—' ? customer.ownerName : 'Customer'}
            </p>
            <div className="ga-cust-account-header__meta">
              {customer.phoneLabel !== '—' ? (
                <span>{customer.phoneLabel}</span>
              ) : null}
              {locationLabel ? <span>{locationLabel}</span> : null}
              {customer.gstin ? <span>GSTIN {customer.gstin}</span> : null}
            </div>
            <div className="ga-cust-account-header__badges">
              <CustomerStatusBadge status={customer.status} />
            </div>
          </div>
        </div>
      </div>

      {canManage ? (
        <div className="ga-cust-account-header__actions">
          <Button variant="secondary" onClick={onEdit}>
            Edit customer
          </Button>
          <Button variant="ghost" onClick={onReassign}>
            Reassign salesman
          </Button>
          {onArchive ? (
            <Button variant="ghost" onClick={onArchive}>
              Archive customer
            </Button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
