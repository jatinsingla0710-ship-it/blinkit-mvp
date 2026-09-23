import type {
  AssistedOrderConfirmationChallenge,
  PaymentMethodIntent,
} from '@groaurum/shared-types';
import type { AssistedOrderConfirmationService } from '../../contracts/assisted-order';
import type { ServiceActionResult } from '../../contracts/order';
import type { GroAurumSupabaseClient } from '../../supabase/client';

type Row = Record<string, unknown>;

export type OrderApprovalPreview = {
  challenge: {
    id: string;
    orderId: string;
    token: string;
    status: string;
    expiresAt: string;
    confirmedAt: string | null;
  };
  order: {
    id: string;
    shopId: string;
    status: string;
    source: string;
    subtotal: number;
    adjustments: number;
    total: number;
    currency: string;
    expectedDeliveryAt: string | null;
    createdAt: string;
  };
  shop: {
    id: string;
    tradeName: string;
    deliveryAddressLine: string;
    deliveryCity: string;
    deliveryState: string;
    deliveryPinCode: string;
  };
  lines: Array<{
    id: string;
    skuId: string;
    productName: string;
    skuName: string;
    skuCode: string;
    sellingUnit: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  expired: boolean;
  canAct: boolean;
};

function str(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapChallenge(row: Row): AssistedOrderConfirmationChallenge {
  return {
    id: str(row['id']),
    orderId: str(row['order_id'] ?? row['orderId']),
    token: str(row['token']),
    status: str(row['status']) as AssistedOrderConfirmationChallenge['status'],
    paymentMethodIntent: row['payment_method_intent']
      ? (str(row['payment_method_intent']) as PaymentMethodIntent)
      : undefined,
    otpHash: row['otp_hash'] ? str(row['otp_hash']) : undefined,
    expiresAt: str(row['expires_at'] ?? row['expiresAt']),
    confirmedAt: row['confirmed_at']
      ? str(row['confirmed_at'])
      : row['confirmedAt']
        ? str(row['confirmedAt'])
        : undefined,
    createdAt: str(row['created_at'] ?? new Date().toISOString()),
    updatedAt: str(row['updated_at'] ?? new Date().toISOString()),
  };
}

function rpcClient(client: GroAurumSupabaseClient) {
  return client as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

/**
 * Assisted order confirmation — token + authenticated shop ownership.
 */
export function createSupabaseAssistedOrderService(
  client: GroAurumSupabaseClient,
): AssistedOrderConfirmationService & {
  getApprovalPreviewByToken(token: string): Promise<OrderApprovalPreview | null>;
  approveByToken(token: string): Promise<string>;
  requestChangesByToken(token: string, reason: string): Promise<string>;
} {
  const rpc = rpcClient(client);

  return {
    async getChallengeByToken(token: string) {
      const preview = await this.getApprovalPreviewByToken(token);
      if (!preview) return null;
      return mapChallenge({
        id: preview.challenge.id,
        order_id: preview.challenge.orderId,
        token: preview.challenge.token,
        status: preview.challenge.status,
        expires_at: preview.challenge.expiresAt,
        confirmed_at: preview.challenge.confirmedAt,
      });
    },

    async getApprovalPreviewByToken(token: string) {
      const { data, error } = await rpc.rpc('get_order_approval_by_token', {
        p_token: token,
      });
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = data as Row;
      const challenge = row['challenge'] as Row;
      const order = row['order'] as Row;
      const shop = row['shop'] as Row;
      const lines = (row['lines'] as Row[]) ?? [];
      return {
        challenge: {
          id: str(challenge['id']),
          orderId: str(challenge['orderId']),
          token: str(challenge['token']),
          status: str(challenge['status']),
          expiresAt: str(challenge['expiresAt']),
          confirmedAt: challenge['confirmedAt']
            ? str(challenge['confirmedAt'])
            : null,
        },
        order: {
          id: str(order['id']),
          shopId: str(order['shopId']),
          status: str(order['status']),
          source: str(order['source']),
          subtotal: num(order['subtotal']),
          adjustments: num(order['adjustments']),
          total: num(order['total']),
          currency: str(order['currency'], 'INR'),
          expectedDeliveryAt: order['expectedDeliveryAt']
            ? str(order['expectedDeliveryAt'])
            : null,
          createdAt: str(order['createdAt']),
        },
        shop: {
          id: str(shop['id']),
          tradeName: str(shop['tradeName']),
          deliveryAddressLine: str(shop['deliveryAddressLine']),
          deliveryCity: str(shop['deliveryCity']),
          deliveryState: str(shop['deliveryState']),
          deliveryPinCode: str(shop['deliveryPinCode']),
        },
        lines: lines.map((line) => ({
          id: str(line['id']),
          skuId: str(line['skuId']),
          productName: str(line['productName']),
          skuName: str(line['skuName']),
          skuCode: str(line['skuCode']),
          sellingUnit: str(line['sellingUnit']),
          quantity: num(line['quantity']),
          unitPrice: num(line['unitPrice']),
          lineTotal: num(line['lineTotal']),
        })),
        expired: Boolean(row['expired']),
        canAct: Boolean(row['canAct']),
      };
    },

    async approveByToken(token: string) {
      const { data, error } = await rpc.rpc('customer_approve_assisted_order', {
        p_token: token,
      });
      if (error) throw new Error(error.message);
      return String(data);
    },

    async requestChangesByToken(token: string, reason: string) {
      const { data, error } = await rpc.rpc('customer_request_order_changes', {
        p_token: token,
        p_reason: reason,
      });
      if (error) throw new Error(error.message);
      return String(data);
    },

    async createChallenge(
      _orderId: string,
    ): Promise<ServiceActionResult<AssistedOrderConfirmationChallenge>> {
      return {
        ok: false,
        error:
          'Use place_assisted_order / reissue_order_approval_challenge trusted RPCs.',
      };
    },

    async sendChallengeToCustomer(orderId: string) {
      const { data, error } = await rpc.rpc('reissue_order_approval_challenge', {
        p_order_id: orderId,
      });
      if (error) {
        return { ok: false, error: error.message };
      }
      const result = data as Row;
      return {
        ok: true,
        data: mapChallenge({
          id: str(result['challengeId']),
          order_id: str(result['orderId']),
          token: '',
          status: 'PENDING',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      };
    },

    async verifyCustomerOtp(
      token: string,
      _otp: string,
      _paymentMethodIntent: PaymentMethodIntent,
    ) {
      try {
        await this.approveByToken(token);
        const challenge = await this.getChallengeByToken(token);
        if (!challenge) {
          return { ok: false, error: 'Challenge not found after approval.' };
        }
        return { ok: true, data: challenge };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Approval failed',
        };
      }
    },

    async recordCustomerRequestedChanges(token: string, note?: string) {
      try {
        await this.requestChangesByToken(token, note ?? 'Changes requested');
        const challenge = await this.getChallengeByToken(token);
        if (!challenge) {
          return { ok: false, error: 'Challenge not found after request.' };
        }
        return { ok: true, data: challenge };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Request changes failed',
        };
      }
    },

    async recordCustomerRejection(token: string, note?: string) {
      return this.recordCustomerRequestedChanges(
        token,
        note ?? 'Customer rejected order',
      );
    },
  };
}
