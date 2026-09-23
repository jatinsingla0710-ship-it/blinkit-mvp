import type {
  Order,
  OrderLine,
  OrderStatus,
  OrderTotals,
} from '@groaurum/shared-types';
import type {
  ConfirmCustomerOrderInput,
  DraftOrderLineInput,
  OrderService,
  ServiceActionResult,
} from '../../contracts/order';
import type { GroAurumSupabaseClient } from '../../supabase/client';

type Row = Record<string, unknown>;

export type CustomerSelfServeLineInput = {
  skuId: string;
  quantity: number;
  /** Ignored by backend — prices resolved from sku_prices. */
  agreedUnitPrice?: number;
};

function str(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapOrderLine(row: Row): OrderLine {
  return {
    id: str(row['id']),
    orderId: str(row['order_id']),
    skuId: str(row['sku_id']),
    productNameSnapshot: str(row['product_name_snapshot']),
    skuNameSnapshot: str(row['sku_name_snapshot']),
    skuCodeSnapshot: str(row['sku_code_snapshot']),
    specificationSnapshot: str(row['specification_snapshot']) || undefined,
    sellingUnitSnapshot: str(row['selling_unit_snapshot']) as OrderLine['sellingUnitSnapshot'],
    quantity: num(row['quantity']),
    agreedUnitPrice: num(row['agreed_unit_price']),
    lineTotal: num(row['line_total']),
  };
}

function mapOrder(row: Row, lines: OrderLine[] = []): Order {
  return {
    id: str(row['id']),
    shopId: str(row['shop_id']),
    status: str(row['status']) as OrderStatus,
    source: str(row['source']) as Order['source'],
    createdByProfileId: str(row['created_by_profile_id']),
    paymentId: row['payment_id'] ? str(row['payment_id']) : null,
    serviceAreaId: str(row['service_area_id']),
    expectedDeliveryAt: row['expected_delivery_at']
      ? str(row['expected_delivery_at'])
      : undefined,
    totals: {
      subtotal: num(row['subtotal']),
      adjustments: num(row['adjustments']),
      total: num(row['total']),
      currency: str(row['currency'], 'INR'),
    },
    lines,
    createdAt: str(row['created_at']),
    updatedAt: str(row['updated_at']),
  };
}

async function loadOrderWithLines(
  client: GroAurumSupabaseClient,
  orderId: string,
): Promise<Order | null> {
  const { data, error } = await client
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: lineRows, error: lineError } = await client
    .from('order_lines')
    .select('*')
    .eq('order_id', orderId);
  if (lineError) throw lineError;

  const lines = ((lineRows ?? []) as Row[]).map(mapOrderLine);
  return mapOrder(data as unknown as Row, lines);
}

function notImplemented(method: string): ServiceActionResult<never> {
  return {
    ok: false,
    error: `OrderService.${method} is not available on the customer client in Sprint 6.`,
  };
}

/**
 * Customer-facing order reads + self-serve place (RPC reserves stock).
 */
export function createSupabaseOrderService(
  client: GroAurumSupabaseClient,
): OrderService & {
  placeCustomerSelfServeOrder(input: {
    shopId: string;
    serviceAreaId: string;
    lines: CustomerSelfServeLineInput[];
    notes?: string;
  }): Promise<Order>;
  listOrderEvents(orderId: string): Promise<
    Array<{
      fromStatus: OrderStatus | null;
      toStatus: OrderStatus;
      note: string | null;
      at: string;
    }>
  >;
} {
  return {
    async getOrderById(orderId: string): Promise<Order | null> {
      return loadOrderWithLines(client, orderId);
    },

    async listOrdersForShop(shopId: string): Promise<Order[]> {
      const { data, error } = await client
        .from('orders')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const orders: Order[] = [];
      for (const row of (data ?? []) as Row[]) {
        const full = await loadOrderWithLines(client, str(row['id']));
        if (full) orders.push(full);
      }
      return orders;
    },

    async placeCustomerSelfServeOrder(input) {
      const { data, error } = await (client as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }).rpc('place_customer_order', {
        p_shop_id: input.shopId,
        p_service_area_id: input.serviceAreaId,
        p_lines: input.lines.map((line) => ({
          skuId: line.skuId,
          quantity: line.quantity,
        })),
        p_notes: input.notes ?? null,
      });
      if (error) throw new Error(error.message);
      const orderId = String(data);
      const order = await loadOrderWithLines(client, orderId);
      if (!order) {
        throw new Error('Order created but could not be reloaded.');
      }
      return order;
    },

    async listOrderEvents(orderId) {
      const { data, error } = await client
        .from('order_events')
        .select('from_status, to_status, note, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Row[]).map((row) => ({
        fromStatus: (row['from_status'] as OrderStatus | null) ?? null,
        toStatus: row['to_status'] as OrderStatus,
        note: (row['note'] as string | null) ?? null,
        at: str(row['created_at']),
      }));
    },

    async createDraftAssistedOrder(
      _shopId: string,
      _lines: DraftOrderLineInput[],
      _createdByProfileId: string,
    ): Promise<ServiceActionResult<Order>> {
      return notImplemented('createDraftAssistedOrder');
    },

    async sendForCustomerConfirmation(_orderId: string) {
      return notImplemented('sendForCustomerConfirmation');
    },

    async confirmCustomerOrder(_input: ConfirmCustomerOrderInput) {
      return notImplemented('confirmCustomerOrder');
    },

    async reserveOrderStock(orderId: string): Promise<ServiceActionResult<Order>> {
      const order = await loadOrderWithLines(client, orderId);
      if (!order) return { ok: false, error: 'Order not found' };
      return { ok: true, data: order };
    },

    async markOrderProcessing(_orderId: string) {
      return notImplemented('markOrderProcessing');
    },
    async markReadyForDispatch(_orderId: string) {
      return notImplemented('markReadyForDispatch');
    },
    async assignOrderToRoute(_orderId: string, _routeId: string) {
      return notImplemented('assignOrderToRoute');
    },
    async markOutForDelivery(_orderId: string) {
      return notImplemented('markOutForDelivery');
    },
    async completeDelivery(_orderId: string) {
      return notImplemented('completeDelivery');
    },
    async failDelivery(_orderId: string, _reason: string, _note?: string) {
      return notImplemented('failDelivery');
    },
    async cancelOrder(_orderId: string, _reason?: string) {
      return notImplemented('cancelOrder');
    },

    async buildOrderTotals(lines: OrderLine[]): Promise<OrderTotals> {
      const subtotal = Number(
        lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2),
      );
      return {
        subtotal,
        adjustments: 0,
        total: subtotal,
        currency: 'INR',
      };
    },

    async getOrderStatus(orderId: string): Promise<OrderStatus | null> {
      const order = await this.getOrderById(orderId);
      return order?.status ?? null;
    },
  };
}
