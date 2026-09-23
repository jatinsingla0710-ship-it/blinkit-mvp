import type { PaymentConfig } from '@/data/settings-types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import './PaymentConfigSection.css';

type Props = {
  payments: PaymentConfig;
};

function ToggleRow({
  label,
  enabled,
  note,
}: {
  label: string;
  enabled: boolean;
  note?: string;
}) {
  return (
    <div className="ga-st-pay__row">
      <div>
        <p className="ga-st-pay__label">{label}</p>
        {note ? <p className="ga-st-pay__note">{note}</p> : null}
      </div>
      <Badge tone={enabled ? 'success' : 'neutral'}>
        {enabled ? 'Enabled' : 'Disabled'}
      </Badge>
    </div>
  );
}

export function PaymentConfigSection({ payments }: Props) {
  return (
    <div className="ga-st-pay">
      <Card>
        <ToggleRow label="COD" enabled={payments.codEnabled} />
        <ToggleRow label="Online" enabled={payments.onlineEnabled} />
        <ToggleRow
          label="Credit"
          enabled={payments.creditEnabled}
          note="Disabled for wholesale default · enable per retailer later"
        />
      </Card>
      <Card title="Payment Gateways">
        <p className="ga-st-pay__placeholder">
          {payments.gatewayPlaceholderLabel}
        </p>
      </Card>
    </div>
  );
}
