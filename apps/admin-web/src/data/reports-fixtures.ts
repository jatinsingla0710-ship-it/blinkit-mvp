import type { ReportsSnapshot } from './reports-types';
import {
  buildSalesReportKpis,
  salesReportEmptyDetail,
} from './reports-sales-map';

/**
 * Mock-mode reports snapshot — honest empty sales metrics (no invented KPIs).
 */
export const REPORTS_SNAPSHOT_FIXTURE: ReportsSnapshot = {
  generatedAtLabel: 'Mock · no live sales',
  kpis: buildSalesReportKpis({ sales: [], payments: [] }),
  filterOptions: {
    dateRanges: [
      { value: 'all', label: 'All Time' },
      { value: '7d', label: 'Last 7 Days' },
      { value: '30d', label: 'Last 30 Days' },
      { value: 'today', label: 'Today' },
    ],
    categories: [{ value: 'all', label: 'All categories' }],
    areas: [{ value: 'all', label: 'All areas' }],
    salesmen: [{ value: 'all', label: 'All salesmen' }],
    warehouses: [{ value: 'all', label: 'All warehouses' }],
    customers: [{ value: 'all', label: 'All customers' }],
  },
  defaultFilters: {
    dateRange: 'all',
    category: 'all',
    area: 'all',
    salesman: 'all',
    warehouse: 'all',
    customer: 'all',
  },
  sections: [
    {
      id: 'sales',
      label: 'Sales',
      intro:
        'Invoiced wholesale from converted sales. Mock mode has no sale rows.',
      reports: [
        {
          id: 'revenue_trend',
          title: 'Revenue by Day',
          question: 'How is invoiced revenue trending over the last 7 days?',
          chartKind: 'bar',
          series: [],
          emptyDetail: salesReportEmptyDetail('revenue'),
        },
        {
          id: 'top_products',
          title: 'Top Products',
          question: 'Which products contribute the most invoiced revenue?',
          chartKind: 'table',
          columns: ['Product', 'SKU', 'Qty', 'Revenue'],
          rows: [],
          emptyDetail: salesReportEmptyDetail('products'),
        },
      ],
    },
    {
      id: 'products',
      label: 'Products',
      intro: 'Catalogue performance beyond invoiced sale_items is not wired yet.',
      reports: [
        {
          id: 'product_performance',
          title: 'Product Performance',
          question: 'Which catalogue products need attention beyond invoiced sales?',
          chartKind: 'table',
          columns: ['Status'],
          rows: [],
          unavailable: true,
          emptyDetail:
            'Not available from converted sales records yet. This section has no live sales-backed query.',
        },
      ],
    },
    {
      id: 'customers',
      label: 'Customers',
      intro: 'Customer acquisition metrics are not derived from sales tables yet.',
      reports: [
        {
          id: 'customer_growth',
          title: 'Customer Growth',
          question: 'How fast is the retailer network growing?',
          chartKind: 'table',
          columns: ['Status'],
          rows: [],
          unavailable: true,
          emptyDetail:
            'Not available from converted sales records yet. This section has no live sales-backed query.',
        },
      ],
    },
    {
      id: 'salesmen',
      label: 'Salesmen',
      intro: 'Field productivity from converted sales linked to order creators.',
      reports: [
        {
          id: 'salesman_leaderboard',
          title: 'Salesman Leaderboard',
          question: 'Who are the top performers by invoiced sales?',
          chartKind: 'table',
          columns: ['Name', 'Sales', 'Revenue'],
          rows: [],
          emptyDetail: salesReportEmptyDetail('salesmen'),
        },
      ],
    },
    {
      id: 'delivery',
      label: 'Delivery',
      intro: 'Delivery efficiency is not computed from sales records.',
      reports: [
        {
          id: 'delivery_efficiency',
          title: 'Delivery Efficiency',
          question: 'How efficient are delivery routes?',
          chartKind: 'table',
          columns: ['Status'],
          rows: [],
          unavailable: true,
          emptyDetail:
            'Not available from converted sales records yet. This section has no live sales-backed query.',
        },
      ],
    },
    {
      id: 'inventory',
      label: 'Inventory',
      intro: 'Stock health is not computed from sales records.',
      reports: [
        {
          id: 'stock_health',
          title: 'Stock Health',
          question: 'What is the overall inventory health?',
          chartKind: 'table',
          columns: ['Status'],
          rows: [],
          unavailable: true,
          emptyDetail:
            'Not available from converted sales records yet. This section has no live sales-backed query.',
        },
      ],
    },
  ],
};
