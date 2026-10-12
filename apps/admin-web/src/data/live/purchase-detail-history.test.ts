import { describe, expect, it, vi } from 'vitest';
import { LiveAdminApi } from './LiveAdminApi';

type Result = { data: unknown; error: { message: string } | null };

/**
 * Minimal thenable query builder that records select() shapes for PostgREST
 * embed contract checks on purchaseDetail history.
 */
function createHistoryAwareClient(opts: {
  purchase: Record<string, unknown> | null;
  receipts: Result;
  returns: Result;
  items?: unknown[];
}) {
  const selects: Array<{ table: string; columns: string }> = [];

  const thenable = (result: Result) => ({
    then: (resolve: (value: Result) => unknown) =>
      Promise.resolve(resolve(result)),
  });

  const chain = (table: string, result: Result) => {
    const builder: Record<string, unknown> = {};
    const self = () => builder;
    builder.select = (columns: string) => {
      selects.push({ table, columns });
      return self();
    };
    builder.eq = self;
    builder.in = self;
    builder.order = self;
    builder.maybeSingle = () => thenable(result);
    builder.then = (resolve: (value: Result) => unknown) =>
      Promise.resolve(resolve(result));
    return builder;
  };

  return {
    selects,
    client: {
      from(table: string) {
        if (table === 'purchases') {
          return chain(table, { data: opts.purchase, error: null });
        }
        if (table === 'purchase_receipts') {
          return chain(table, opts.receipts);
        }
        if (table === 'purchase_returns') {
          return chain(table, opts.returns);
        }
        if (table === 'purchase_items') {
          return chain(table, {
            data: opts.items ?? [
              {
                id: 'pi-1',
                sku_id: 'sku-1',
                product_name: 'Rice',
                sku_code: 'RICE',
                sku_name: '1kg',
                quantity: 10,
                unit_cost: 100,
                line_total: 1000,
              },
            ],
            error: null,
          });
        }
        if (table === 'suppliers') {
          return chain(table, {
            data: { id: 's1', name: 'Acme' },
            error: null,
          });
        }
        if (table === 'operational_locations') {
          return chain(table, {
            data: { id: 'w1', name: 'Main' },
            error: null,
          });
        }
        if (table === 'supplier_payments') {
          return chain(table, { data: [], error: null });
        }
        if (table === 'profiles') {
          return chain(table, {
            data: [{ id: 'a1', display_name: 'Owner', mobile: null }],
            error: null,
          });
        }
        return chain(table, { data: [], error: null });
      },
    },
  };
}

const basePurchase = {
  id: 'p1',
  supplier_id: 's1',
  operational_location_id: 'w1',
  purchase_date: '2026-10-11',
  bill_number: 'INV-HIST',
  status: 'PARTIALLY_RECEIVED',
  notes: null,
  received_at: null,
  first_received_at: '2026-10-11T10:00:00Z',
  subtotal: 1000,
  tax_amount: 180,
  cgst_amount: 90,
  sgst_amount: 90,
  igst_amount: 0,
  supply_type: 'INTRA',
  total: 1180,
};

describe('LiveAdminApi purchaseDetail history contract (Phase 6B.4)', () => {
  it('requests nested receipt/return line embeds', async () => {
    const { client, selects } = createHistoryAwareClient({
      purchase: basePurchase,
      receipts: { data: [], error: null },
      returns: { data: [], error: null },
    });
    // loadPurchasePayableEventTotals also queries receipts/returns headers
    vi.spyOn(
      LiveAdminApi.prototype as unknown as {
        loadPurchasePayableEventTotals: (
          ids: string[],
        ) => Promise<Map<string, unknown>>;
      },
      'loadPurchasePayableEventTotals',
    ).mockResolvedValue(
      new Map([
        [
          'p1',
          {
            receiptTotal: 0,
            returnTotal: 0,
            hasReceiptEvents: false,
          },
        ],
      ]),
    );

    const api = new LiveAdminApi(client as never);
    await api.purchaseDetail('p1');

    const receiptSelect = selects.find((s) => s.table === 'purchase_receipts');
    const returnSelect = selects.find((s) => s.table === 'purchase_returns');
    expect(receiptSelect?.columns).toContain('purchase_receipt_lines(');
    expect(receiptSelect?.columns).toContain('purchase_item_id');
    expect(returnSelect?.columns).toContain('purchase_return_lines(');
    expect(returnSelect?.columns).toContain('purchase_item_id');
  });

  it('maps empty history without inventing lines', async () => {
    vi.spyOn(
      LiveAdminApi.prototype as unknown as {
        loadPurchasePayableEventTotals: (
          ids: string[],
        ) => Promise<Map<string, unknown>>;
      },
      'loadPurchasePayableEventTotals',
    ).mockResolvedValue(
      new Map([
        [
          'p1',
          { receiptTotal: 0, returnTotal: 0, hasReceiptEvents: false },
        ],
      ]),
    );

    const { client } = createHistoryAwareClient({
      purchase: { ...basePurchase, status: 'DRAFT', first_received_at: null },
      receipts: { data: [], error: null },
      returns: { data: [], error: null },
    });
    const api = new LiveAdminApi(client as never);
    const detail = await api.purchaseDetail('p1');
    expect(detail?.receiptHistory).toEqual([]);
    expect(detail?.returnHistory).toEqual([]);
    expect(detail?.items[0]?.receivedQuantity).toBe(0);
    expect(detail?.items[0]?.returnedQuantity).toBe(0);
  });

  it('maps populated receipt and return history lines', async () => {
    vi.spyOn(
      LiveAdminApi.prototype as unknown as {
        loadPurchasePayableEventTotals: (
          ids: string[],
        ) => Promise<Map<string, unknown>>;
      },
      'loadPurchasePayableEventTotals',
    ).mockResolvedValue(
      new Map([
        [
          'p1',
          {
            receiptTotal: 590,
            returnTotal: 118,
            hasReceiptEvents: true,
          },
        ],
      ]),
    );

    const { client } = createHistoryAwareClient({
      purchase: basePurchase,
      receipts: {
        data: [
          {
            id: 'rcpt-1',
            received_at: '2026-10-11T10:00:00Z',
            actor_profile_id: 'a1',
            taxable_amount: 500,
            tax_amount: 90,
            total_amount: 590,
            purchase_receipt_lines: [
              {
                id: 'rl-1',
                purchase_item_id: 'pi-1',
                quantity: 5,
                unit_cost: 100,
                line_taxable: 500,
              },
            ],
          },
        ],
        error: null,
      },
      returns: {
        data: [
          {
            id: 'ret-1',
            returned_at: '2026-10-11T12:00:00Z',
            actor_profile_id: 'a1',
            reason: 'Damaged',
            taxable_amount: 100,
            tax_amount: 18,
            total_amount: 118,
            purchase_return_lines: [
              {
                id: 'rtl-1',
                purchase_item_id: 'pi-1',
                quantity: 1,
                unit_cost: 100,
                line_total: 100,
              },
            ],
          },
        ],
        error: null,
      },
    });

    const api = new LiveAdminApi(client as never);
    const detail = await api.purchaseDetail('p1');
    expect(detail?.receiptHistory).toHaveLength(1);
    expect(detail?.receiptHistory[0]?.lines[0]).toMatchObject({
      purchaseItemId: 'pi-1',
      quantity: 5,
      productName: 'Rice',
    });
    expect(detail?.returnHistory).toHaveLength(1);
    expect(detail?.returnHistory[0]?.reason).toBe('Damaged');
    expect(detail?.returnHistory[0]?.lines[0]?.quantity).toBe(1);
    expect(detail?.items[0]?.receivedQuantity).toBe(5);
    expect(detail?.items[0]?.returnedQuantity).toBe(1);
    expect(detail?.items[0]?.remainingReturnable).toBe(4);
  });

  it('surfaces receipt query errors instead of empty history', async () => {
    vi.spyOn(
      LiveAdminApi.prototype as unknown as {
        loadPurchasePayableEventTotals: (
          ids: string[],
        ) => Promise<Map<string, unknown>>;
      },
      'loadPurchasePayableEventTotals',
    ).mockResolvedValue(
      new Map([
        [
          'p1',
          { receiptTotal: 0, returnTotal: 0, hasReceiptEvents: false },
        ],
      ]),
    );

    const { client } = createHistoryAwareClient({
      purchase: basePurchase,
      receipts: {
        data: null,
        error: { message: 'Could not embed purchase_receipt_lines' },
      },
      returns: { data: [], error: null },
    });
    const api = new LiveAdminApi(client as never);
    await expect(api.purchaseDetail('p1')).rejects.toThrow(
      /purchase receipts|embed/i,
    );
  });
});
