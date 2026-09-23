import { formatInr } from '@/data/live/format';
import type {
  PaymentReconciliationStatus,
  PaymentsOverviewVm,
  PaymentStatusDb,
} from '@/data/payments-types';

export type PaymentReconInput = {
  status: string;
  providerReference?: string | null;
  /** When false, online confirmation path is unavailable globally. */
  bankConfirmationConfigured?: boolean;
};

/**
 * Evidence-based reconciliation for online payments.
 * MATCHED only when PAID and a non-empty provider_reference exists.
 * Never invent bank-side rows — MISMATCH requires both sides (not invented here).
 */
export function reconcilePaymentStatus(
  payment: PaymentReconInput,
): PaymentReconciliationStatus {
  if (payment.bankConfirmationConfigured === false) {
    return 'NOT_CONFIGURED';
  }

  const status = String(payment.status ?? '').toUpperCase();
  const ref = (payment.providerReference ?? '').trim();

  if (status === 'PAID' && ref) {
    return 'MATCHED';
  }

  if (status === 'PAID' || status === 'PAYMENT_PENDING') {
    return 'PENDING_VERIFICATION';
  }

  return 'PENDING_VERIFICATION';
}

export function reconciliationStatusLabel(
  status: PaymentReconciliationStatus,
): string {
  switch (status) {
    case 'MATCHED':
      return 'Matched';
    case 'MISMATCH':
      return 'Mismatch';
    case 'NOT_CONFIGURED':
      return 'Not configured';
    case 'PENDING_VERIFICATION':
    default:
      return 'Pending verification';
  }
}

export function isOnlinePaymentMethod(input: {
  methodIntent?: string | null;
  collectionMethod?: string | null;
}): boolean {
  const intent = String(input.methodIntent ?? '').toUpperCase();
  const method = String(input.collectionMethod ?? '').toUpperCase();
  return (
    intent === 'PAY_ONLINE_NOW' ||
    method === 'ONLINE_GATEWAY' ||
    method === 'UPI_ON_DELIVERY' ||
    method === 'CARD_ON_DELIVERY' ||
    method === 'OTHER'
  );
}

/** Driver-reported bank/UPI awaiting admin verification (not company-received). */
export function isReportedDigitalAwaitingVerification(input: {
  status?: string | null;
  collectionMethod?: string | null;
}): boolean {
  const status = String(input.status ?? '').toUpperCase();
  const method = String(input.collectionMethod ?? '').toUpperCase();
  return (
    status === 'PAYMENT_PENDING' &&
    method !== '' &&
    method !== 'CASH_ON_DELIVERY'
  );
}

export function isCashOrCodPaymentMethod(input: {
  methodIntent?: string | null;
  collectionMethod?: string | null;
}): boolean {
  const intent = String(input.methodIntent ?? '').toUpperCase();
  const method = String(input.collectionMethod ?? '').toUpperCase();
  if (intent === 'PAY_ON_DELIVERY') return true;
  return (
    method === 'CASH_ON_DELIVERY' ||
    method === 'UPI_ON_DELIVERY' ||
    method === 'CARD_ON_DELIVERY' ||
    method === 'OTHER'
  );
}

export function normalizePaymentStatus(raw: string): PaymentStatusDb {
  const status = String(raw ?? '').toUpperCase();
  switch (status) {
    case 'UNPAID':
    case 'PAYMENT_PENDING':
    case 'PAID':
    case 'FAILED':
    case 'REFUNDED':
      return status;
    default:
      return 'UNPAID';
  }
}

export type AdminPaymentsOverviewRpc = {
  asOfDate?: string;
  sales?: number;
  received?: number;
  pendingCustomerPayment?: number;
  withDeliveryBoys?: number;
  settledToCompany?: number;
  online?: number;
  cash?: number;
  paymentBankConfirmationConfigured?: boolean;
  reconciliationGlobalStatus?: string;
};

export function formatPaymentsOverview(
  raw: AdminPaymentsOverviewRpc,
): PaymentsOverviewVm {
  const sales = Number(raw.sales ?? 0);
  const received = Number(raw.received ?? 0);
  const pendingCustomerPayment = Number(raw.pendingCustomerPayment ?? 0);
  const withDeliveryBoys = Number(raw.withDeliveryBoys ?? 0);
  const settledToCompany = Number(raw.settledToCompany ?? 0);
  const online = Number(raw.online ?? 0);
  const cash = Number(raw.cash ?? 0);
  const configured = Boolean(raw.paymentBankConfirmationConfigured);
  const global =
    String(raw.reconciliationGlobalStatus ?? '').toUpperCase() ===
    'NOT_CONFIGURED'
      ? 'NOT_CONFIGURED'
      : configured
        ? 'EVIDENCE_BASED'
        : 'NOT_CONFIGURED';

  return {
    asOfDate: String(raw.asOfDate ?? ''),
    sales,
    received,
    pendingCustomerPayment,
    withDeliveryBoys,
    settledToCompany,
    online,
    cash,
    salesLabel: formatInr(sales),
    receivedLabel: formatInr(received),
    pendingCustomerPaymentLabel: formatInr(pendingCustomerPayment),
    withDeliveryBoysLabel: formatInr(withDeliveryBoys),
    settledToCompanyLabel: formatInr(settledToCompany),
    onlineLabel: formatInr(online),
    cashLabel: formatInr(cash),
    paymentBankConfirmationConfigured: configured,
    reconciliationGlobalStatus: global,
  };
}
