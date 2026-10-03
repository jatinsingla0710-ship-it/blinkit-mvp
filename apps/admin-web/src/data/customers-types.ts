/**
 * Customer Management v1 view models.
 * Wholesale retailer network console — ready for Supabase shop / invite queries later.
 */

import type { CustomerDigitalAccessVm } from '@/data/customer-digital-access';
import type { CustomerLedgerVm } from '@/data/customer-ledger';

export type CustomerAccountStatus = 'active' | 'inactive';

export type DigitalAccessStatus =
  | 'not_activated'
  | 'app_link_sent'
  | 'activated'
  | 'access_disabled';

export type ActivationWorkflowState =
  | 'created'
  | 'invitation_sent'
  | 'activated';

/** Derived from order history / lifecycle — not a separate DB column. */
export type CustomerOrderClass = 'none' | 'first_order' | 'repeat';

export type PreferredPaymentVm = 'COD' | 'Online' | 'Credit' | 'not_set';

export type PaymentStatusVm =
  | 'PAID'
  | 'UNPAID'
  | 'PENDING'
  | 'PARTIAL'
  | 'REFUNDED'
  | 'UNKNOWN';

export interface CustomersDashboardKpi {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger' | 'info';
  href?: string;
}

export interface CustomerListRow {
  id: string;
  shopName: string;
  ownerName: string;
  phoneLabel: string;
  areaLabel: string;
  serviceAreaId?: string;
  salesmanName: string;
  lastOrderLabel: string;
  preferredPayment: PreferredPaymentVm;
  /** Business operational status (orders/delivery allowed). */
  status: CustomerAccountStatus;
  digitalAccess: DigitalAccessStatus;
  digitalAccessLabel: string;
  createdAtIso: string;
  appLinkSentAtIso?: string;
}

export interface CustomerHealth {
  ordersThisMonth: number;
  averageOrderValueLabel: string;
  lastOrderDateLabel: string;
  lastPaymentStatus: PaymentStatusVm;
}

export interface ActivationStage {
  state: ActivationWorkflowState;
  label: string;
  detail: string;
  stateKind: 'done' | 'current' | 'upcoming';
  at?: string;
}

export interface CustomerOrderRow {
  id: string;
  orderCode: string;
  valueLabel: string;
  fulfillmentLabel: string;
  fulfillmentStatus: string;
  paymentStatus: PaymentStatusVm;
  placedAtLabel: string;
  /** ISO timestamp for sorting / ageing / timeline (preferred over label). */
  placedAtIso?: string;
  /** Pre-sale / order invoice number when present. */
  invoiceNumber?: string | null;
  totalAmount: number;
}

export interface CustomerAccountSummary {
  totalOrders: number;
  totalSalesLabel: string;
  currentOrders: number;
  outForDelivery: number;
  needsAttention: number;
  outstandingLabel: string | null;
  fySalesLabel: string;
  fyLabel: string;
  completedSalesCount: number;
  lastPurchaseLabel: string;
}

export interface CustomerAttentionItem {
  id: string;
  reason: string;
  description: string;
  actionLabel: string;
  href: string;
}

export interface CustomerTimelineEvent {
  id: string;
  atLabel: string;
  title: string;
  detail?: string;
  href?: string;
  sortKey: string;
}

export interface CustomerPaymentRow {
  id: string;
  orderCode: string;
  methodLabel: string;
  amountLabel: string;
  status: PaymentStatusVm;
  atLabel: string;
  /** ISO timestamp for timeline sorting. */
  atIso?: string;
  orderId?: string;
}

export interface CustomerAddressRow {
  id: string;
  label: string;
  text: string;
  isPrimary: boolean;
  serviceable: boolean;
}

export interface CustomerActivityRow {
  id: string;
  atLabel: string;
  actorLabel: string;
  actionLabel: string;
  detail: string;
}

export interface CustomerDocumentRow {
  id: string;
  name: string;
  typeLabel: string;
  statusLabel: string;
  uploadedAtLabel: string;
}

export interface CustomerDetail {
  id: string;
  shopName: string;
  ownerName: string;
  phoneLabel: string;
  emailLabel?: string | null;
  /** Login mobile from shop_auth_links → profiles (if activated). */
  linkedLoginMobileLabel?: string | null;
  contactMobileMatchesLogin?: boolean;
  areaLabel: string;
  serviceAreaId?: string;
  legalName?: string | null;
  deliveryAddressLine?: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryPinCode?: string;
  assignedSalesmanProfileId?: string;
  salesmanName: string;
  preferredPayment: PreferredPaymentVm;
  status: CustomerAccountStatus;
  digitalAccess: DigitalAccessStatus;
  digitalAccessVm: CustomerDigitalAccessVm;
  activationState: ActivationWorkflowState;
  /** First / repeat from real orders + lifecycle (H2). */
  orderClass: CustomerOrderClass;
  orderClassLabel: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  hasPendingInvitation?: boolean;
  pendingInvitationExpiresAtLabel?: string | null;
  appLinkSentAtLabel?: string | null;
  appLinkSentByLabel?: string | null;
  createdAtLabel: string;
  updatedAtLabel: string;
  health: CustomerHealth;
  summary: CustomerAccountSummary;
  /** Derived ledger from orders + payments (no separate journal table). */
  ledger: CustomerLedgerVm;
  attentionItems: CustomerAttentionItem[];
  timeline: CustomerTimelineEvent[];
  activation: ActivationStage[];
  orders: CustomerOrderRow[];
  payments: CustomerPaymentRow[];
  addresses: CustomerAddressRow[];
  activity: CustomerActivityRow[];
  documents: CustomerDocumentRow[];
}

export interface CustomersSnapshot {
  generatedAtLabel: string;
  kpis: CustomersDashboardKpi[];
  rows: CustomerListRow[];
  createDefaults?: {
    serviceAreaId: string;
    deliveryCity: string;
    deliveryState: string;
    deliveryPinCode: string;
  };
}

export interface CustomerInvitationResult {
  invitationId: string;
  shopId: string;
  mobile: string;
  token: string;
  expiresAt: string;
}
