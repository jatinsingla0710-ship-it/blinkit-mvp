import type { CodCustodySummary } from '@/data/delivery-types';

/** Real payment statuses only — never invent synthetic ones. */
export type PaymentStatusDb =
  | 'UNPAID'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED';

export type PaymentReconciliationStatus =
  | 'MATCHED'
  | 'MISMATCH'
  | 'PENDING_VERIFICATION'
  | 'NOT_CONFIGURED';

export interface PaymentsOverviewVm {
  asOfDate: string;
  salesLabel: string;
  receivedLabel: string;
  pendingCustomerPaymentLabel: string;
  withDeliveryBoysLabel: string;
  settledToCompanyLabel: string;
  onlineLabel: string;
  cashLabel: string;
  paymentBankConfirmationConfigured: boolean;
  reconciliationGlobalStatus: 'EVIDENCE_BASED' | 'NOT_CONFIGURED';
  /** Raw amounts for tests / further formatting. */
  sales: number;
  received: number;
  pendingCustomerPayment: number;
  withDeliveryBoys: number;
  settledToCompany: number;
  online: number;
  cash: number;
}

export interface PaymentListRow {
  id: string;
  orderId: string;
  orderCode: string;
  shopName: string;
  amount: number;
  amountLabel: string;
  status: PaymentStatusDb;
  statusLabel: string;
  methodIntent: string | null;
  collectionMethod: string | null;
  methodLabel: string;
  cashCollected: number;
  cashCollectedLabel: string;
  onlineCollected: number;
  onlineCollectedLabel: string;
  /** Customer payment status (PAID ≠ Admin settled). */
  customerPaymentLabel: string;
  collectedByLabel: string;
  custodyStatus: string | null;
  custodyStatusLabel: string;
  settlementStatusLabel: string;
  settledAtLabel: string;
  orderStatus: string | null;
  providerReference: string | null;
  paidAtLabel: string;
  createdAtLabel: string;
  reconciliationStatus: PaymentReconciliationStatus;
  reconciliationLabel: string;
}

export interface PaymentsCashCodVm {
  custody: CodCustodySummary[];
  codExpectedLabel: string;
  codCollectedLabel: string;
  pendingCollectionLabel: string;
  withDriversLabel: string;
}

export interface PaymentSettlementVm {
  deliveryProfileId: string;
  driverName: string;
  withDriverAmount: number;
  withDriverLabel: string;
  withManagerAmount: number;
  withManagerLabel: string;
  collectedAmount: number;
  collectedLabel: string;
  adminSettledAmount: number;
  adminSettledLabel: string;
  orderCount: number;
  handedOverAmount: number;
  settledAmount: number;
}

export type PaymentsTabId =
  | 'overview'
  | 'all'
  | 'cash'
  | 'online'
  | 'settlements'
  | 'reconciliation';
