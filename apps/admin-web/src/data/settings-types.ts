/**
 * Settings & System Configuration v1 view models.
 * Company profile fields match the canonical settings.company JSON contract.
 */

import type { CompanySettingsValue } from '@groaurum/validation';

export type SettingsSectionId =
  | 'company'
  | 'warehouses'
  | 'service_areas'
  | 'delivery_slots'
  | 'payments'
  | 'notifications'
  | 'taxes'
  | 'roles'
  | 'preferences';

export type EntityStatus = 'active' | 'disabled';

/** Alias of the canonical company settings JSON document. */
export type CompanyProfile = CompanySettingsValue;

export interface WarehouseRow {
  id: string;
  name: string;
  city: string;
  state: string;
  pinCode: string;
  addressLine: string;
  status: EntityStatus;
}

export interface ServiceAreaRow {
  id: string;
  name: string;
  description: string;
  pinCount: number;
  pinCodes: string[];
  status: EntityStatus;
}

export interface DeliverySlotRow {
  id: string;
  name: string;
  windowLabel: string;
  kind: 'morning' | 'afternoon' | 'evening' | 'custom';
  enabled: boolean;
}

export interface PaymentConfig {
  codEnabled: boolean;
  onlineEnabled: boolean;
  creditEnabled: boolean;
  gatewayPlaceholderLabel: string;
}

export interface NotificationTemplateRow {
  id: string;
  channel: 'sms' | 'whatsapp' | 'push' | 'email';
  channelLabel: string;
  templateName: string;
  subjectLabel: string;
  statusLabel: string;
}

export interface TaxConfigRow {
  id: string;
  categoryLabel: string;
  gstPercentLabel: string;
  hsnCode: string;
}

export interface UserRoleRow {
  id: string;
  roleName: string;
  description: string;
  usersCount: number;
  permissionsLabel: string;
}

export interface SystemPreferences {
  currencyLabel: string;
  timezoneLabel: string;
  dateFormatLabel: string;
  languageLabel: string;
}

export interface SettingsSnapshot {
  generatedAtLabel: string;
  company: CompanyProfile;
  warehouses: WarehouseRow[];
  serviceAreas: ServiceAreaRow[];
  deliverySlots: DeliverySlotRow[];
  payments: PaymentConfig;
  notifications: NotificationTemplateRow[];
  taxes: TaxConfigRow[];
  roles: UserRoleRow[];
  preferences: SystemPreferences;
}
