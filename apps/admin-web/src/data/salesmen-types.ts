/**
 * Salesman Management view models (H1–H4).
 */

export type SalesmanStatus = 'active' | 'on_leave' | 'inactive' | 'suspended';

export type VisitStatus = 'planned' | 'completed' | 'missed';

export type CustomerActivationStatus =
  | 'created'
  | 'invitation_sent'
  | 'activated';

export type SalesmanSortId =
  | 'name_az'
  | 'orders_desc'
  | 'customers_desc'
  | 'updated_desc';

export type SalesmanAttendanceStatusVm =
  | 'PRESENT'
  | 'ABSENT'
  | 'PAID_LEAVE'
  | 'UNPAID_LEAVE'
  | 'HOLIDAY'
  | 'WEEKLY_OFF';

export interface SalesmenDashboardKpi {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}

export interface SalesmanListRow {
  id: string;
  name: string;
  territory: string;
  assignedCustomers: number;
  ordersThisMonth: number;
  collectionsLabel: string;
  status: SalesmanStatus;
  updatedAtLabel: string;
}

export interface SalesmanBrowseState {
  query: string;
  status: 'all' | SalesmanStatus;
  sort: SalesmanSortId;
  page: number;
  pageSize: number;
}

export interface SalesmanAssignedCustomer {
  id: string;
  shopName: string;
  areaLabel: string;
  accountStatusLabel: string;
  lastOrderLabel: string;
  lastVisitLabel: string;
  activationStatus: CustomerActivationStatus;
  activationLabel: string;
}

export interface SalesmanOrderRow {
  id: string;
  orderCode: string;
  customerName: string;
  amountLabel: string;
  statusLabel: string;
  dateLabel: string;
}

export interface SalesmanCollectionSummary {
  codCollectedLabel: string;
  onlinePaymentsLabel: string;
  pendingCollectionsLabel: string;
}

export interface SalesmanCollectionRow {
  id: string;
  orderCode: string;
  customerName: string;
  methodLabel: string;
  amountLabel: string;
  statusLabel: string;
  atLabel: string;
}

export interface SalesmanPerformance {
  ordersThisMonth: number;
  revenueGeneratedLabel: string;
  newCustomers: number;
  repeatCustomers: number;
  activationSuccessRateLabel: string;
  averageOrderValueLabel: string;
  visitsCompletedThisMonth?: number;
  visitsMissedThisMonth?: number;
  customersVisitedThisMonth?: number;
  collectionsLabel?: string;
}

export interface SalesmanVisitRow {
  id: string;
  shopName: string;
  areaLabel: string;
  plannedAtLabel: string;
  status: VisitStatus;
  note?: string;
}

export type SalesmanEarningModelVm =
  | 'SALARY'
  | 'COMMISSION'
  | 'SALARY_PLUS_COMMISSION';

export interface SalesmanEmploymentVm {
  joiningDate: string;
  joiningDateLabel: string;
  employmentStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  earningModel: SalesmanEarningModelVm;
  address: string | null;
  contactEmail: string | null;
  idProofType: 'AADHAAR' | 'PAN' | 'OTHER' | null;
  idProofNumber: string | null;
  primaryServiceAreaId: string | null;
  primaryServiceAreaLabel: string;
  weeklyOffDow: number;
  weeklyOffLabel: string;
  workingDays: number[];
  workingDaysLabel: string;
}

export interface SalesmanSalaryTermsVm {
  id: string;
  monthlySalary: number;
  monthlySalaryLabel: string;
  dailyAllowance: number;
  dailyAllowanceLabel: string;
  otherAllowance: number;
  otherAllowanceLabel: string;
  effectiveFrom: string;
  effectiveFromLabel: string;
  effectiveTo: string | null;
  effectiveToLabel: string | null;
}

export interface SalesmanAttendanceRow {
  id: string;
  workDate: string;
  workDateLabel: string;
  status: SalesmanAttendanceStatusVm;
  dayStartedAtLabel: string | null;
  dayEndedAtLabel: string | null;
  correctionReason: string | null;
}

export interface SalesmanSalaryMonthVm {
  year: number;
  month: number;
  monthLabel: string;
  monthlySalaryLabel: string;
  dailyAllowanceLabel: string;
  otherAllowanceLabel: string;
  scheduledWorkingDays: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  absentDays: number;
  dailyRateLabel: string;
  unpaidDeductionLabel: string;
  finalPayableLabel: string;
  formulaLabel: string;
  unavailableReason?: string;
}

export interface SalesmanDetail {
  id: string;
  name: string;
  phoneLabel: string;
  emailLabel: string;
  employeeId: string;
  territory: string;
  joiningDateLabel: string;
  status: SalesmanStatus;
  assignedCustomersCount: number;
  totalOrders: number;
  updatedAtLabel: string;
  assignedCustomers: SalesmanAssignedCustomer[];
  orders: SalesmanOrderRow[];
  collections: SalesmanCollectionSummary;
  collectionHistory: SalesmanCollectionRow[];
  performance: SalesmanPerformance;
  visits: SalesmanVisitRow[];
  visitsSource?: 'sales_visits';
  employment: SalesmanEmploymentVm | null;
  currentSalary: SalesmanSalaryTermsVm | null;
  salaryHistory: SalesmanSalaryTermsVm[];
  attendance: SalesmanAttendanceRow[];
  salaryMonth: SalesmanSalaryMonthVm | null;
}

export interface SalesmenSnapshot {
  generatedAtLabel: string;
  kpis: SalesmenDashboardKpi[];
  rows: SalesmanListRow[];
}
