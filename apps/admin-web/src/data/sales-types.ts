import type { PaymentStatusVm } from '@/data/orders-types';

/** One row in the sales register table. */
export type SaleRegisterRow = {
  saleId: string;
  orderId: string;
  invoiceNumber: string;
  orderCode: string;
  customerName: string;
  saleDateLabel: string;
  saleDateIso: string;
  amount: number;
  amountLabel: string;
  paymentStatus: PaymentStatusVm;
  paymentMethodLabel: string;
  saleStatus: string;
  saleStatusLabel: string;
};
