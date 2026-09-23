import { CustomerDigitalAccessPanel } from '@/components/customers/CustomerDigitalAccessPanel';
import { Card } from '@/components/ui/Card';
import type { CustomerDigitalAccessVm } from '@/data/customer-digital-access';

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

export function CustomerAppAccessCard(props: Props) {
  return (
    <Card className="ga-cust-account-card ga-cust-account-app-access">
      <CustomerDigitalAccessPanel {...props} />
    </Card>
  );
}
