import type { CustomerDigitalAccessVm } from '@/data/customer-digital-access';
import {
  buildCustomerAppWhatsappMessage,
  buildWhatsappShareUrl,
} from '@groaurum/shared-types';
import { Button } from '@groaurum/ui';
import { DigitalAccessBadge } from '@/components/customers/CustomerStatusBadges';
import { getCustomerAppUrl } from '@/data/customer-app-config';
import './CustomerDigitalAccessPanel.css';

type Props = {
  access: CustomerDigitalAccessVm;
  customerName: string;
  ownerName: string;
  mobile: string;
  canManage?: boolean;
  sending?: boolean;
  onSendViaWhatsapp?: () => void | Promise<void>;
  onCopyLink?: () => void;
  copyFeedback?: string | null;
};

export function CustomerDigitalAccessPanel({
  access,
  customerName,
  ownerName,
  mobile,
  canManage = false,
  sending = false,
  onSendViaWhatsapp,
  onCopyLink,
  copyFeedback,
}: Props) {
  const displayName = ownerName.trim() || customerName.trim() || 'Customer';
  const appUrl = getCustomerAppUrl();
  const previewMessage = buildCustomerAppWhatsappMessage({
    customerName: displayName,
    appUrl,
  });

  return (
    <div className="ga-cust-digital-access">
      <p className="ga-cust-digital-access__label">Customer App Access</p>
      <DigitalAccessBadge status={access.status} label={access.label} />
      <p className="ga-cust-digital-access__desc">{access.description}</p>

      {access.mobileLabel ? (
        <p className="ga-cust-digital-access__meta">
          Registered mobile: {access.mobileLabel}
        </p>
      ) : null}
      {access.appLinkSentAtLabel ? (
        <p className="ga-cust-digital-access__meta">
          App link sent: {access.appLinkSentAtLabel}
          {access.appLinkSentByLabel ? ` · ${access.appLinkSentByLabel}` : ''}
        </p>
      ) : null}
      {access.activatedAtLabel ? (
        <p className="ga-cust-digital-access__meta">
          Activated: {access.activatedAtLabel}
        </p>
      ) : null}

      {canManage && access.status !== 'activated' && access.status !== 'access_disabled' ? (
        <div className="ga-cust-digital-access__actions">
          <Button
            variant="primary"
            disabled={sending || !mobile || mobile === '-'}
            onClick={() => void onSendViaWhatsapp?.()}
          >
            {sending ? 'Recording…' : 'Send App Link via WhatsApp'}
          </Button>
          <Button
            variant="secondary"
            disabled={!onCopyLink}
            onClick={onCopyLink}
          >
            Copy App Link
          </Button>
          {copyFeedback ? (
            <p className="ga-cust-digital-access__copy-ok">{copyFeedback}</p>
          ) : null}
        </div>
      ) : null}

      {canManage && access.status === 'activated' ? (
        <p className="ga-cust-digital-access__hint">
          Customer can log in anytime using their registered mobile number and OTP.
        </p>
      ) : null}

      {import.meta.env.DEV && canManage ? (
        <details className="ga-cust-digital-access__preview">
          <summary>Message preview</summary>
          <pre>{previewMessage}</pre>
          {mobile && mobile !== '-' ? (
            <p className="ga-cust-digital-access__meta">
              WhatsApp: {buildWhatsappShareUrl(mobile, previewMessage)}
            </p>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}
