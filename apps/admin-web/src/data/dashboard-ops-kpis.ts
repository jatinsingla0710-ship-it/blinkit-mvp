import { formatInr } from '@/data/live/format';

import type { ExecutiveKpi } from '@/data/dashboard-types';

import { ordersPresetHref } from '@/data/dashboard-helpers';



/** Payload from `admin_ops_dashboard_kpis` RPC. */

export type AdminOpsDashboardKpisRpc = {

  asOfDate?: string;

  monthlyRevenue?: number;

  pendingOrders?: number;

  /** Still computed by RPC for salesmen module; not shown on executive dashboard. */

  salesmenWorkingToday?: number;

  inTransitOrders?: number;

  workloadDelivered?: number;

  workloadTotal?: number;

  workloadRemaining?: number;

  /** Customer unpaid residual on OUT_FOR_DELIVERY orders (not order totals). */

  pendingToReceiveTotal?: number;

  pendingToReceiveOrders?: number;

  pendingToReceiveCash?: number;

  pendingToReceiveOnline?: number;

  pendingToReceiveUnknown?: number;

  /** RECEIVED_BY_MANAGER cash — not yet RECEIVED_BY_OWNER. */

  managerCollectionsPending?: number;

  /** WITH_DRIVER cash custody — includes converted sales until Admin settles. */

  driverCollectionsPending?: number;

  driverCollectionsCash?: number;

  driverCollectionsOnline?: number;

  paymentBankConfirmationConfigured?: boolean;

  paymentOnlineProviderConfigured?: boolean;

};



function num(v: unknown): number {

  const n = Number(v);

  return Number.isFinite(n) ? n : 0;

}



/**

 * Map RPC KPI payload → six executive cards.

 * Callers must throw on RPC failure — never pass fabricated zeros from errors.

 *

 * Card 3 = cash with Manager (RECEIVED_BY_MANAGER).

 * Card 5 = customer money still owed on OFD orders.

 * Card 6 = cash with Delivery Boys (WITH_DRIVER) — ≠ Card 3 or Card 5.

 */

export function mapOpsDashboardKpisToExecutive(

  kpis: AdminOpsDashboardKpisRpc,

): ExecutiveKpi[] {

  const monthlyRevenue = num(kpis.monthlyRevenue);

  const pendingOrders = num(kpis.pendingOrders);

  const inTransit = num(kpis.inTransitOrders);

  const workloadDelivered = num(kpis.workloadDelivered);

  const workloadTotal = num(kpis.workloadTotal);

  const workloadRemaining = num(kpis.workloadRemaining);

  const managerPending = num(kpis.managerCollectionsPending);

  const pendingToReceive = num(kpis.pendingToReceiveTotal);

  const pendingOrdersCount = num(kpis.pendingToReceiveOrders);

  const driverPending = num(kpis.driverCollectionsPending);

  const driverCash = num(kpis.driverCollectionsCash);

  const driverOnline = num(kpis.driverCollectionsOnline);



  const inTransitValue =

    workloadTotal > 0

      ? `${workloadDelivered} / ${workloadTotal}`

      : `${inTransit}`;



  return [

    {

      id: 'monthly_revenue',

      label: 'Monthly Revenue',

      value: formatInr(monthlyRevenue),

      hint: 'Converted sales this month',

      tone: 'positive',

      href: '/sales',

    },

    {

      id: 'pending_orders',

      label: 'Pending Orders',

      value: `${pendingOrders}`,

      hint: 'Processing · packing · dispatch',

      tone: pendingOrders > 0 ? 'warning' : 'default',

      href: ordersPresetHref('pending'),

    },

    {

      id: 'manager_collections_pending',

      label: 'Payment to Receive from Managers',

      value: formatInr(managerPending),

      hint:

        managerPending > 0

          ? 'Cash currently with warehouse managers'

          : 'No pending manager handovers',

      tone: managerPending > 0 ? 'warning' : 'default',

      href: '/payments?tab=settlements&focus=with_manager',

    },

    {

      id: 'in_transit',

      label: 'In Transit',

      value: inTransitValue,

      hint:

        workloadTotal > 0

          ? `Delivered · Remaining ${workloadRemaining} · OFD ${inTransit}`

          : inTransit > 0

            ? `${inTransit} out for delivery`

            : 'No active delivery workload',

      tone: inTransit > 0 || workloadRemaining > 0 ? 'warning' : 'default',

      href: '/delivery?focus=in_transit',

    },

    {

      id: 'pending_to_receive',

      label: 'Payment Yet to Receive',

      value: formatInr(pendingToReceive),

      hint:

        pendingOrdersCount > 0

          ? `Customer unpaid on OFD · ${pendingOrdersCount} order(s)`

          : 'Customer unpaid on out-for-delivery orders',

      tone: pendingToReceive > 0 ? 'warning' : 'default',

      href: '/payments?tab=all&focus=ofd_unpaid',

    },

    {

      id: 'driver_collections_pending',

      label: 'Delivery Collections Pending',

      value: formatInr(driverPending),

      hint: `Cash with drivers ${formatInr(driverCash)} · Online ${formatInr(driverOnline)}`,

      tone: driverPending > 0 ? 'warning' : 'default',

      href: '/payments?tab=settlements&focus=with_driver',

    },

  ];

}



/** Parse jsonb RPC result; throw if shape is unusable (caller already threw on transport error). */

export function parseOpsDashboardKpisRpc(data: unknown): AdminOpsDashboardKpisRpc {

  if (data == null || typeof data !== 'object') {

    throw new Error('admin_ops_dashboard_kpis returned empty payload');

  }

  return data as AdminOpsDashboardKpisRpc;

}



/** Pure helpers for cash/remaining UX + Card 5 residual (testable without DB). */

export function computePaymentRemaining(input: {

  amountDue: number;

  cashReceived: number;

  onlineConfirmed?: number;

}): { remaining: number; overpayment: boolean; canComplete: boolean } {

  const due = Number(input.amountDue) || 0;

  const cash = Number(input.cashReceived) || 0;

  const online = Number(input.onlineConfirmed ?? 0) || 0;

  if (cash < 0 || online < 0) {

    return { remaining: due, overpayment: false, canComplete: false };

  }

  if (cash + online > due + 1e-9) {

    return { remaining: 0, overpayment: true, canComplete: false };

  }

  const remaining = Math.round((due - cash - online) * 100) / 100;

  return {

    remaining: Math.max(remaining, 0),

    overpayment: false,

    canComplete: remaining <= 0,

  };

}



/** Card 5 residual for one OFD order — never counts WITH_DRIVER cash as unpaid. */

export function ofdCustomerUnpaidResidual(input: {

  orderTotal: number;

  paymentStatus?: string | null;

  cashCollected?: number;

  onlineCollected?: number;

}): number {

  if (String(input.paymentStatus ?? '').toUpperCase() === 'PAID') return 0;

  const due = Number(input.orderTotal) || 0;

  const cash = Number(input.cashCollected ?? 0) || 0;

  const online = Number(input.onlineCollected ?? 0) || 0;

  return Math.max(Math.round((due - cash - online) * 100) / 100, 0);

}



/** Card 3: manager-held cash (RECEIVED_BY_MANAGER only). */

export function managerCustodyPendingAmount(input: {

  custodyStatus?: string | null;

  cashAmount?: number;

}): number {

  if (String(input.custodyStatus ?? '').toUpperCase() !== 'RECEIVED_BY_MANAGER') {

    return 0;

  }

  return Math.max(Number(input.cashAmount ?? 0) || 0, 0);

}



/** Card 6 contribution: only unsettled cash custody with driver (sale conversion irrelevant). */

export function driverCustodyPendingAmount(input: {

  custodyStatus?: string | null;

  cashAmount?: number;

  isConvertedSale?: boolean;

}): number {

  if (String(input.custodyStatus ?? '').toUpperCase() !== 'WITH_DRIVER') {

    return 0;

  }

  return Math.max(Number(input.cashAmount ?? 0) || 0, 0);

}


