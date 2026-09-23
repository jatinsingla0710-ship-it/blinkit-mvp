import type { SettingsSnapshot } from './settings-types';

/**
 * Layout fixtures only — replace with Supabase org / warehouse / policy settings.
 * UI review surface; no mutations in v1.
 */

export const SETTINGS_SNAPSHOT_FIXTURE: SettingsSnapshot = {
  generatedAtLabel: 'Today · layout fixture',
  company: {
    companyName: 'GroAurum Wholesale Pvt Ltd',
    gstNumber: '07AABCG1234D1Z5',
    pan: 'AABCG1234D',
    email: 'ops@groaurum.in',
    phone: '+91 11 XXXX 4400',
    logo: 'groaurum-logo.png · 240×80',
    address: 'Okhla Industrial Area Phase II, New Delhi 110020',
  },
  warehouses: [
    {
      id: 'a3000000-0000-4000-8000-000000000001',
      name: 'GroAurum Warehouse 1',
      city: 'New Delhi',
      state: 'Delhi',
      pinCode: '110074',
      addressLine: 'Warehouse Complex, Sector 37',
      status: 'active',
    },
    {
      id: 'wh-noida',
      name: 'Noida Buffer',
      city: 'Noida',
      state: 'Uttar Pradesh',
      pinCode: '201301',
      addressLine: 'Sector 63, Noida',
      status: 'active',
    },
    {
      id: 'wh-ggn',
      name: 'Gurugram Cross-dock',
      city: 'Gurugram',
      state: 'Haryana',
      pinCode: '122016',
      addressLine: 'Udyog Vihar',
      status: 'disabled',
    },
  ],
  serviceAreas: [
    {
      id: 'a2000000-0000-4000-8000-000000000001',
      name: 'South Delhi',
      description:
        'GroAurum launch service area — South Delhi grocery + FMCG wholesale',
      pinCount: 7,
      pinCodes: [
        '110017',
        '110019',
        '110020',
        '110024',
        '110048',
        '110062',
        '110074',
      ],
      status: 'active',
    },
  ],
  deliverySlots: [
    {
      id: 'slot-morning',
      name: 'Morning',
      windowLabel: '08:00 – 12:00',
      kind: 'morning',
      enabled: true,
    },
    {
      id: 'slot-afternoon',
      name: 'Afternoon',
      windowLabel: '12:00 – 16:00',
      kind: 'afternoon',
      enabled: true,
    },
    {
      id: 'slot-evening',
      name: 'Evening',
      windowLabel: '16:00 – 20:00',
      kind: 'evening',
      enabled: true,
    },
    {
      id: 'slot-custom',
      name: 'Custom Slot',
      windowLabel: '06:00 – 08:00 · early wholesale',
      kind: 'custom',
      enabled: false,
    },
  ],
  payments: {
    codEnabled: true,
    onlineEnabled: true,
    creditEnabled: false,
    gatewayPlaceholderLabel:
      'Payment gateway credentials · future (Razorpay / UPI)',
  },
  notifications: [
    {
      id: 'n1',
      channel: 'sms',
      channelLabel: 'SMS',
      templateName: 'Order Confirmed',
      subjectLabel: 'Your GroAurum order {{order_id}} is confirmed',
      statusLabel: 'Active · view only',
    },
    {
      id: 'n2',
      channel: 'whatsapp',
      channelLabel: 'WhatsApp',
      templateName: 'Out for Delivery',
      subjectLabel: 'Order {{order_id}} is out for delivery',
      statusLabel: 'Active · view only',
    },
    {
      id: 'n3',
      channel: 'push',
      channelLabel: 'Push Notification',
      templateName: 'Invitation Sent',
      subjectLabel: 'Activate your GroAurum retailer account',
      statusLabel: 'Draft · view only',
    },
    {
      id: 'n4',
      channel: 'email',
      channelLabel: 'Email',
      templateName: 'Daily Manifest',
      subjectLabel: 'Route manifest for {{route_id}}',
      statusLabel: 'Active · view only',
    },
  ],
  taxes: [
    {
      id: 'tx1',
      categoryLabel: 'Almonds',
      gstPercentLabel: '5%',
      hsnCode: '0802',
    },
    {
      id: 'tx2',
      categoryLabel: 'Cashews',
      gstPercentLabel: '5%',
      hsnCode: '0801',
    },
    {
      id: 'tx3',
      categoryLabel: 'Raisins',
      gstPercentLabel: '5%',
      hsnCode: '0806',
    },
    {
      id: 'tx4',
      categoryLabel: 'Mixed packs',
      gstPercentLabel: '12%',
      hsnCode: '2008',
    },
  ],
  roles: [
    {
      id: 'role-super',
      roleName: 'Super Admin',
      description: 'Full system configuration and overrides',
      usersCount: 2,
      permissionsLabel: 'All modules · settings write',
    },
    {
      id: 'role-ops',
      roleName: 'Operations Manager',
      description: 'Orders, delivery, and day-to-day ops',
      usersCount: 4,
      permissionsLabel: 'Orders · Delivery · Customers',
    },
    {
      id: 'role-wh',
      roleName: 'Warehouse Manager',
      description: 'Inventory, packing, and stock moves',
      usersCount: 3,
      permissionsLabel: 'Inventory · Products (read)',
    },
    {
      id: 'role-sales',
      roleName: 'Sales Manager',
      description: 'Salesmen, retail coverage, activations',
      usersCount: 2,
      permissionsLabel: 'Salesmen · Customers · Pricing (read)',
    },
    {
      id: 'role-delivery',
      roleName: 'Delivery Manager',
      description: 'Routes, drivers, COD closeout',
      usersCount: 3,
      permissionsLabel: 'Delivery · Orders (read)',
    },
    {
      id: 'role-ro',
      roleName: 'Read Only',
      description: 'View dashboards and reports only',
      usersCount: 5,
      permissionsLabel: 'Reports · Dashboard',
    },
  ],
  preferences: {
    currencyLabel: 'INR (₹)',
    timezoneLabel: 'Asia/Kolkata (IST)',
    dateFormatLabel: 'DD MMM YYYY',
    languageLabel: 'English (India)',
  },
};
