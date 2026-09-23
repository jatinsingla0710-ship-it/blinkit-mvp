import type { AssistedOrderConfirmationChallenge, PaymentMethodIntent } from '@groaurum/shared-types';
import type { ServiceActionResult } from './order';

export interface AssistedOrderConfirmationService {
  getChallengeByToken(token: string): Promise<AssistedOrderConfirmationChallenge | null>;
  createChallenge(orderId: string): Promise<ServiceActionResult<AssistedOrderConfirmationChallenge>>;
  sendChallengeToCustomer(
    orderId: string
  ): Promise<ServiceActionResult<AssistedOrderConfirmationChallenge>>;
  verifyCustomerOtp(
    token: string,
    otp: string,
    paymentMethodIntent: PaymentMethodIntent
  ): Promise<ServiceActionResult<AssistedOrderConfirmationChallenge>>;
  recordCustomerRequestedChanges(
    token: string,
    note?: string
  ): Promise<ServiceActionResult<AssistedOrderConfirmationChallenge>>;
  recordCustomerRejection(
    token: string,
    note?: string
  ): Promise<ServiceActionResult<AssistedOrderConfirmationChallenge>>;
}
