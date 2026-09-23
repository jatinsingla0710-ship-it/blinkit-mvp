import type { PaymentMethodIntent, StaffRole } from './enums';

export const PAYMENT_STATUSES = [
  'UNPAID',
  'PAYMENT_PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface Payment {
  id: string;
  orderId: string;
  status: PaymentStatus;
  methodIntent: PaymentMethodIntent;
  amount: number;
  currency: string;
  providerReference?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEvent {
  id: string;
  paymentId: string;
  fromStatus: PaymentStatus | null;
  toStatus: PaymentStatus;
  actorProfileId?: string;
  actorRole?: StaffRole;
  note?: string;
  createdAt: string;
}
