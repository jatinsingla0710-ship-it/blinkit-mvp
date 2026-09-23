import type { Payment, PaymentStatus, PaymentMethodIntent } from '@groaurum/shared-types';
import type { ServiceActionResult } from './order';

export interface RecordPaymentInput {
  orderId: string;
  methodIntent: PaymentMethodIntent;
  amount: number;
  currency: string;
  providerReference?: string;
}

export interface PaymentService {
  getPaymentByOrderId(orderId: string): Promise<Payment | null>;
  createPaymentIntent(input: RecordPaymentInput): Promise<ServiceActionResult<Payment>>;
  recordPayment(input: RecordPaymentInput): Promise<ServiceActionResult<Payment>>;
  markPaymentPending(paymentId: string): Promise<ServiceActionResult<Payment>>;
  markPaymentPaid(paymentId: string, providerReference?: string): Promise<ServiceActionResult<Payment>>;
  markPaymentFailed(paymentId: string, reason?: string): Promise<ServiceActionResult<Payment>>;
  markPaymentRefunded(paymentId: string, reason?: string): Promise<ServiceActionResult<Payment>>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus | null>;
}
