import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  canConvertOrderToSale,
  getNextOrderAction,
} from './order-helpers';
import {
  autoSkuDisplayName,
  openingStockToPackQuantity,
} from './product-create-helpers';
import {
  formatInventoryQuantityLabel,
  formatQuantityWithUnit,
} from './quantity-display';
import { mapSaleItemsToOrderLines } from './sale-invoice-map';
import {
  packTradePriceFromBasis,
  packsPerBoxFromQuantities,
  boxValueFromPacks,
} from './sku-pack-pricing';
import { hasPermission } from '@groaurum/auth';

const invoiceSource = readFileSync(
  resolve(__dirname, '../components/orders/OrderInvoicePrint.tsx'),
  'utf8',
);

describe('Orders/Invoice correction pass', () => {
  it('invoice source does not render Discount, Payment Status, or Delivery Status', () => {
    expect(invoiceSource).not.toMatch(/>\s*Disc\s*</);
    expect(invoiceSource).not.toMatch(/Payment:\s*\{/);
    expect(invoiceSource).not.toMatch(/Delivery:\s*\{/);
    expect(invoiceSource).not.toMatch(/order\.payment\.discount/);
    expect(invoiceSource).not.toMatch(/discountLabel/);
  });

  it('invoice quantity displays unit', () => {
    expect(formatQuantityWithUnit(2, 'kg')).toBe('2 kg');
    expect(formatQuantityWithUnit(5, 'pcs')).toBe('5 pcs');
    expect(formatQuantityWithUnit(12, 'bags')).toBe('12 bags');
    expect(formatQuantityWithUnit(250, 'g')).toBe('250 g');
  });

  it('sale line mapping includes selling unit on quantity label', () => {
    const lines = mapSaleItemsToOrderLines([
      {
        id: 'si-1',
        product_name: 'Badam',
        sku_code: 'BADAM-250G',
        sku_name: 'Badam 250g',
        quantity: 2,
        unit_price: 250,
        discount: 0,
        line_total: 500,
        selling_unit: 'PACK',
      },
    ]);
    expect(lines[0]?.quantityLabel).toBe('2 packs');
  });

  it('Convert to Sale only when Delivered + PAID', () => {
    expect(
      canConvertOrderToSale({
        fulfillmentStatus: 'DELIVERED',
        paymentStatus: 'PAID',
      }),
    ).toBe(true);
    expect(
      canConvertOrderToSale({
        fulfillmentStatus: 'DELIVERED',
        paymentStatus: 'UNPAID',
      }),
    ).toBe(false);
    expect(
      canConvertOrderToSale({
        fulfillmentStatus: 'OUT_FOR_DELIVERY',
        paymentStatus: 'PAID',
      }),
    ).toBe(false);
    expect(
      canConvertOrderToSale({
        fulfillmentStatus: 'DELIVERED',
        paymentStatus: 'PAID',
        saleId: 'sale-1',
      }),
    ).toBe(false);

    const eligible = getNextOrderAction({
      fulfillmentStatus: 'DELIVERED',
      paymentStatus: 'PAID',
    });
    expect(eligible.id).toBe('convert_to_sale');

    const unpaid = getNextOrderAction({
      fulfillmentStatus: 'DELIVERED',
      paymentStatus: 'UNPAID',
    });
    expect(unpaid.id).toBe('receive_payment');
    expect(unpaid.hint.toLowerCase()).toMatch(/sale conversion/);

    const refunded = getNextOrderAction({
      fulfillmentStatus: 'DELIVERED',
      paymentStatus: 'REFUNDED',
    });
    expect(refunded.id).toBe('none');
    expect(refunded.label.toLowerCase()).toMatch(/unavailable/);
  });
});

describe('Product create / pack pricing / initial inventory', () => {
  it('auto-generates SKU name from product + pack', () => {
    expect(autoSkuDisplayName('Badam', 250, 'g')).toBe('Badam 250g');
  });

  it('price basis ₹1000/kg → ₹250 per 250 g pack', () => {
    expect(
      packTradePriceFromBasis({
        basisPrice: 1000,
        priceBasis: 'per_kg',
        packQuantity: 250,
        packUnit: 'g',
      }),
    ).toEqual({ packTradePrice: 250 });
  });

  it('box 12 kg → 48 packs and ₹12,000 box value', () => {
    const packs = packsPerBoxFromQuantities({
      packQuantity: 250,
      packUnit: 'g',
      boxQuantity: 12,
      boxUnit: 'kg',
    });
    expect(packs).toEqual({ packsPerBox: 48 });
    expect(
      boxValueFromPacks({ packTradePrice: 250, packsPerBox: 48 }),
    ).toEqual({ boxValue: 12000 });
  });

  it('initial inventory 60 kg → 240 packs for 250 g pack', () => {
    expect(
      openingStockToPackQuantity({
        quantity: 60,
        unit: 'kg',
        packQuantity: 250,
        packUnit: 'g',
      }),
    ).toEqual({ onHandPacks: 240 });
  });

  it('inventory display shows 60 kg for 240 × 250 g packs', () => {
    expect(
      formatInventoryQuantityLabel({
        quantity: 240,
        sellingUnit: 'PACK',
        netQuantity: 250,
        netQuantityUnit: 'g',
      }),
    ).toBe('60 kg');
  });
});

describe('Product delete RBAC (AppRole permissions)', () => {
  it('Admin / super_admin can manage products (delete UI + soft-delete path)', () => {
    expect(
      hasPermission({ roles: ['super_admin'], permission: 'products:manage' }),
    ).toBe(true);
  });

  it('read_only cannot manage products', () => {
    expect(
      hasPermission({ roles: ['read_only'], permission: 'products:manage' }),
    ).toBe(false);
  });

  it('warehouse_manager cannot manage products', () => {
    expect(
      hasPermission({
        roles: ['warehouse_manager'],
        permission: 'products:manage',
      }),
    ).toBe(false);
  });
});
