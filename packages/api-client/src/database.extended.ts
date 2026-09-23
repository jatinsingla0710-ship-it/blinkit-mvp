/**
 * Sprint 4 schema extensions layered on database.generated.ts.
 * Prefer regenerating via `pnpm db:types` after local `db:reset`; this file
 * keeps packages type-safe until regeneration catches up.
 */
import type { Database as GeneratedDatabase, Json } from './database.generated';

type SoftDelete = { deleted_at: string | null };

type ProductImages = {
  Row: {
    id: string;
    product_id: string;
    url: string;
    alt_text: string | null;
    display_order: number;
    is_primary: boolean;
    media_kind: 'IMAGE' | 'VIDEO';
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    product_id: string;
    url: string;
    alt_text?: string | null;
    display_order?: number;
    is_primary?: boolean;
    media_kind?: 'IMAGE' | 'VIDEO';
    deleted_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<ProductImages['Insert']>;
  Relationships: [
    {
      foreignKeyName: 'product_images_product_id_fkey';
      columns: ['product_id'];
      isOneToOne: false;
      referencedRelation: 'products';
      referencedColumns: ['id'];
    },
  ];
};

type CustomerAddresses = {
  Row: {
    id: string;
    shop_id: string;
    label: string;
    address_line: string;
    city: string;
    state: string;
    pin_code: string;
    lat: number | null;
    lng: number | null;
    is_default: boolean;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    shop_id: string;
    label?: string;
    address_line: string;
    city: string;
    state: string;
    pin_code: string;
    lat?: number | null;
    lng?: number | null;
    is_default?: boolean;
    deleted_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<CustomerAddresses['Insert']>;
  Relationships: [
    {
      foreignKeyName: 'customer_addresses_shop_id_fkey';
      columns: ['shop_id'];
      isOneToOne: false;
      referencedRelation: 'shops';
      referencedColumns: ['id'];
    },
  ];
};

type Settings = {
  Row: {
    id: string;
    setting_key: string;
    setting_value: Json;
    description: string | null;
    updated_by_profile_id: string | null;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    setting_key: string;
    setting_value?: Json;
    description?: string | null;
    updated_by_profile_id?: string | null;
    deleted_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<Settings['Insert']>;
  Relationships: [];
};

type ReportsSnapshot = {
  Row: {
    id: string;
    snapshot_key: string;
    payload: Json;
    generated_at: string;
    generated_by_profile_id: string | null;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    snapshot_key?: string;
    payload?: Json;
    generated_at?: string;
    generated_by_profile_id?: string | null;
    deleted_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<ReportsSnapshot['Insert']>;
  Relationships: [];
};

type SalesVisitStatus = 'PLANNED' | 'VISITED' | 'PENDING' | 'MISSED';

type SalesVisits = {
  Row: {
    id: string;
    salesman_profile_id: string;
    shop_id: string;
    planned_at: string;
    status: SalesVisitStatus;
    notes: string | null;
    visited_at: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    salesman_profile_id: string;
    shop_id: string;
    planned_at?: string;
    status?: SalesVisitStatus;
    notes?: string | null;
    visited_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<SalesVisits['Insert']>;
  Relationships: [
    {
      foreignKeyName: 'sales_visits_salesman_profile_id_fkey';
      columns: ['salesman_profile_id'];
      isOneToOne: false;
      referencedRelation: 'profiles';
      referencedColumns: ['id'];
    },
    {
      foreignKeyName: 'sales_visits_shop_id_fkey';
      columns: ['shop_id'];
      isOneToOne: false;
      referencedRelation: 'shops';
      referencedColumns: ['id'];
    },
  ];
};

type SalesmanAttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'PAID_LEAVE'
  | 'UNPAID_LEAVE'
  | 'HOLIDAY'
  | 'WEEKLY_OFF';

type SalesmanAttendance = {
  Row: {
    id: string;
    profile_id: string;
    work_date: string;
    status: SalesmanAttendanceStatus;
    day_started_at: string | null;
    day_ended_at: string | null;
    correction_reason: string | null;
    recorded_by_profile_id: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    profile_id: string;
    work_date: string;
    status: SalesmanAttendanceStatus;
    day_started_at?: string | null;
    day_ended_at?: string | null;
    correction_reason?: string | null;
    recorded_by_profile_id?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<SalesmanAttendance['Insert']>;
  Relationships: [
    {
      foreignKeyName: 'salesman_attendance_profile_id_fkey';
      columns: ['profile_id'];
      isOneToOne: false;
      referencedRelation: 'profiles';
      referencedColumns: ['id'];
    },
  ];
};

type SalesmanEmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
type SalesmanEarningModel =
  | 'SALARY'
  | 'COMMISSION'
  | 'SALARY_PLUS_COMMISSION';
type SalesmanIdProofType = 'AADHAAR' | 'PAN' | 'OTHER';
type SalesmanCommissionEntryStatus = 'EARNED' | 'REVERSED';

type SalesmanEmployment = {
  Row: {
    profile_id: string;
    joining_date: string;
    employment_status: SalesmanEmploymentStatus;
    earning_model: SalesmanEarningModel;
    address: string | null;
    contact_email: string | null;
    id_proof_type: SalesmanIdProofType | null;
    id_proof_number: string | null;
    primary_service_area_id: string | null;
    weekly_off_dow: number;
    working_days: number[];
    created_at: string;
    updated_at: string;
  };
  Insert: {
    profile_id: string;
    joining_date?: string;
    employment_status?: SalesmanEmploymentStatus;
    earning_model?: SalesmanEarningModel;
    address?: string | null;
    contact_email?: string | null;
    id_proof_type?: SalesmanIdProofType | null;
    id_proof_number?: string | null;
    primary_service_area_id?: string | null;
    weekly_off_dow?: number;
    working_days?: number[];
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<SalesmanEmployment['Insert']>;
  Relationships: [
    {
      foreignKeyName: 'salesman_employment_profile_id_fkey';
      columns: ['profile_id'];
      isOneToOne: true;
      referencedRelation: 'profiles';
      referencedColumns: ['id'];
    },
  ];
};

type SalesmanSalaryTerms = {
  Row: {
    id: string;
    profile_id: string;
    monthly_salary: number;
    daily_allowance: number;
    other_allowance: number;
    effective_from: string;
    effective_to: string | null;
    recorded_by_profile_id: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    profile_id: string;
    monthly_salary: number;
    daily_allowance?: number;
    other_allowance?: number;
    effective_from: string;
    effective_to?: string | null;
    recorded_by_profile_id?: string | null;
    created_at?: string;
  };
  Update: Partial<SalesmanSalaryTerms['Insert']>;
  Relationships: [
    {
      foreignKeyName: 'salesman_salary_terms_profile_id_fkey';
      columns: ['profile_id'];
      isOneToOne: false;
      referencedRelation: 'profiles';
      referencedColumns: ['id'];
    },
  ];
};

type CompanyHolidays = {
  Row: {
    id: string;
    holiday_date: string;
    name: string;
    service_area_id: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    holiday_date: string;
    name: string;
    service_area_id?: string | null;
    created_at?: string;
  };
  Update: Partial<CompanyHolidays['Insert']>;
  Relationships: [];
};

type Sprint7Functions = {
  salesman_create_retailer: {
    Args: {
      p_trade_name: string;
      p_primary_contact_name: string;
      p_primary_contact_mobile: string;
      p_delivery_address_line: string;
      p_delivery_city: string;
      p_delivery_state: string;
      p_delivery_pin_code: string;
      p_service_area_id?: string | null;
      p_legal_name?: string | null;
      p_delivery_lat?: number | null;
      p_delivery_lng?: number | null;
    };
    Returns: string;
  };
  salesman_set_shop_delivery_location: {
    Args: {
      p_shop_id: string;
      p_delivery_lat: number;
      p_delivery_lng: number;
    };
    Returns: Json;
  };
  salesman_create_invitation: {
    Args: {
      p_shop_id: string;
      p_mobile?: string | null;
    };
    Returns: Json;
  };
  place_assisted_order: {
    Args: {
      p_shop_id: string;
      p_service_area_id: string;
      p_lines: Json;
      p_notes?: string | null;
    };
    Returns: string;
  };
  salesman_start_day: {
    Args: { p_work_date?: string | null };
    Returns: Json;
  };
  salesman_end_day: {
    Args: { p_work_date?: string | null };
    Returns: Json;
  };
};

type Sprint8Functions = {
  delivery_start_route: {
    Args: { p_route_id: string };
    Returns: string;
  };
  delivery_mark_stop_in_progress: {
    Args: { p_stop_id: string };
    Returns: string;
  };
  delivery_collect_cod: {
    Args: {
      p_order_id: string;
      p_collected_amount: number;
      p_collection_method?: string;
    };
    Returns: string;
  };
  delivery_record_cash_payment: {
    Args: {
      p_order_id: string;
      p_cash_amount: number;
    };
    Returns: Json;
  };
  delivery_report_digital_payment: {
    Args: {
      p_order_id: string;
      p_amount: number;
      p_collection_method: string;
      p_reference?: string | null;
      p_notes?: string | null;
    };
    Returns: Json;
  };
  admin_verify_reported_payment: {
    Args: {
      p_order_id: string;
      p_note?: string | null;
    };
    Returns: Json;
  };
  admin_reject_reported_payment: {
    Args: {
      p_order_id: string;
      p_note?: string | null;
    };
    Returns: Json;
  };
  payment_online_provider_configured: {
    Args: Record<string, never>;
    Returns: boolean;
  };
  delivery_complete_stop: {
    Args: {
      p_stop_id: string;
      p_notes?: string | null;
      p_photo_captured?: boolean;
      p_signature_captured?: boolean;
      p_collect_cod_amount?: number | null;
    };
    Returns: string;
  };
  delivery_fail_stop: {
    Args: {
      p_stop_id: string;
      p_failure_reason: string;
      p_notes?: string | null;
      p_photo_captured?: boolean;
    };
    Returns: string;
  };
  delivery_complete_route: {
    Args: { p_route_id: string };
    Returns: Json;
  };
};

type Sprint9Functions = {
  write_audit_log: {
    Args: {
      p_action: string;
      p_entity_type: string;
      p_entity_id: string;
      p_payload?: Json | null;
      p_actor_profile_id?: string | null;
      p_actor_role?: string | null;
    };
    Returns: string;
  };
  log_application_event: {
    Args: {
      p_level: string;
      p_source: string;
      p_message: string;
      p_context?: Json | null;
      p_rpc_name?: string | null;
      p_duration_ms?: number | null;
    };
    Returns: string;
  };
  enqueue_notification: {
    Args: {
      p_channel: string;
      p_template_key: string;
      p_recipient: string;
      p_payload?: Json;
      p_related_entity_type?: string | null;
      p_related_entity_id?: string | null;
    };
    Returns: string;
  };
  create_online_payment_intent: {
    Args: {
      p_order_id: string;
      p_amount: number;
      p_currency?: string;
      p_provider_reference?: string | null;
    };
    Returns: string;
  };
  apply_payment_webhook_event: {
    Args: {
      p_provider: string;
      p_provider_event_id: string;
      p_provider_reference: string;
      p_status: string;
      p_amount?: number | null;
      p_raw?: Json | null;
    };
    Returns: string;
  };
  job_expire_stock_reservations: {
    Args: Record<string, never>;
    Returns: Json;
  };
  job_expire_shop_invitations: {
    Args: Record<string, never>;
    Returns: Json;
  };
  job_claim_notification_batch: {
    Args: { p_limit?: number };
    Returns: Json;
  };
  mark_notification_sent: {
    Args: { p_id: string; p_provider_message_id?: string | null };
    Returns: undefined;
  };
  mark_notification_failed: {
    Args: { p_id: string; p_error: string };
    Returns: undefined;
  };
  job_drain_notification_outbox: {
    Args: { p_limit?: number };
    Returns: Json;
  };
  update_order_status_admin: {
    Args: {
      p_order_id: string;
      p_to_status: string;
      p_note?: string | null;
    };
    Returns: string;
  };
  admin_advance_order_to: {
    Args: {
      p_order_id: string;
      p_to_status: string;
      p_note?: string | null;
    };
    Returns: string;
  };
  admin_assign_order_delivery: {
    Args: {
      p_order_id: string;
      p_delivery_profile_id: string;
    };
    Returns: string;
  };
  admin_assign_order_to_route: {
    Args: {
      p_order_id: string;
      p_route_id: string;
    };
    Returns: string;
  };
  admin_mark_payment_received: {
    Args: {
      p_order_id: string;
      p_collection_method?: string;
      p_note?: string | null;
    };
    Returns: string;
  };
  admin_record_invoice_printed: {
    Args: {
      p_order_id: string;
      p_note?: string | null;
    };
    Returns: string;
  };
  admin_convert_order_to_sale: {
    Args: { p_order_id: string };
    Returns: Json;
  };
  admin_cancel_order: {
    Args: {
      p_order_id: string;
      p_note?: string | null;
    };
    Returns: Json;
  };
  admin_refund_converted_sale: {
    Args: {
      p_order_id: string;
      p_reason?: string | null;
      p_restock?: boolean;
    };
    Returns: Json;
  };
  admin_reassign_shop_salesman: {
    Args: {
      p_shop_id: string;
      p_new_salesman_profile_id: string;
      p_reason?: string | null;
    };
    Returns: Json;
  };
  admin_create_sales_visit: {
    Args: {
      p_salesman_profile_id: string;
      p_shop_id: string;
      p_planned_at?: string | null;
      p_notes?: string | null;
    };
    Returns: Json;
  };
  admin_update_sales_visit_status: {
    Args: {
      p_visit_id: string;
      p_status: SalesVisitStatus;
    };
    Returns: Json;
  };
  admin_upsert_salesman_employment: {
    Args: {
      p_profile_id: string;
      p_joining_date?: string | null;
      p_employment_status?: SalesmanEmploymentStatus;
      p_address?: string | null;
      p_contact_email?: string | null;
      p_id_proof_type?: SalesmanIdProofType | null;
      p_id_proof_number?: string | null;
      p_primary_service_area_id?: string | null;
      p_weekly_off_dow?: number;
      p_working_days?: number[];
    };
    Returns: Json;
  };
  admin_set_salesman_salary_terms: {
    Args: {
      p_profile_id: string;
      p_monthly_salary: number;
      p_daily_allowance?: number;
      p_other_allowance?: number;
      p_effective_from?: string | null;
    };
    Returns: Json;
  };
  admin_set_salesman_earning_model: {
    Args: {
      p_profile_id: string;
      p_earning_model: SalesmanEarningModel;
    };
    Returns: Json;
  };
  admin_set_sku_commission_term: {
    Args: {
      p_sku_id: string;
      p_fixed_amount_per_unit: number;
      p_effective_from?: string | null;
    };
    Returns: Json;
  };
  admin_set_salesman_attendance: {
    Args: {
      p_profile_id: string;
      p_work_date: string;
      p_status: SalesmanAttendanceStatus;
      p_reason?: string | null;
    };
    Returns: Json;
  };
  admin_upsert_company_holiday: {
    Args: {
      p_holiday_date: string;
      p_name: string;
      p_service_area_id?: string | null;
      p_holiday_id?: string | null;
    };
    Returns: Json;
  };
};

// ─── Delivery H5 ─────────────────────────────────────────────────────────────

type DeliveryEmploymentStatus = 'ACTIVE' | 'INACTIVE';
type DeliveryOperationalStatus =
  | 'AVAILABLE'
  | 'ON_ROUTE'
  | 'OFF_DUTY'
  | 'UNAVAILABLE';
type DeliveryIdProofType = 'AADHAAR' | 'PAN' | 'OTHER';
type VehicleStatusDb =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'ON_ROUTE'
  | 'MAINTENANCE'
  | 'UNAVAILABLE';
type DeliveryScheduleEventKind = 'SCHEDULED' | 'RESCHEDULED' | 'DELAYED';
type DeliveryCodCustodyStatus =
  | 'WITH_DRIVER'
  | 'RECEIVED_BY_MANAGER'
  | 'RECEIVED_BY_OWNER'
  | 'HANDED_TO_COMPANY'
  | 'RECONCILED';
type DeliveryExceptionCategory =
  | 'DRIVER'
  | 'VEHICLE'
  | 'WAREHOUSE_ORDER'
  | 'EXTERNAL'
  | 'CUSTOMER';
type DeliveryExceptionStatus = 'OPEN' | 'RESOLVED' | 'CANCELLED';
type DeliveryExceptionAction =
  | 'RESUME'
  | 'REPLACE_DRIVER'
  | 'REPLACE_VEHICLE'
  | 'RESCHEDULE_ROUTE'
  | 'CANCEL_ATTEMPT';
type DeliveryNotificationEventKind =
  | 'DELIVERY_SCHEDULED'
  | 'DELIVERY_RESCHEDULED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERY_COMPLETED'
  | 'DELIVERY_FAILED'
  | 'DELIVERY_DELAYED';

type DeliveryEmployment = {
  Row: {
    profile_id: string;
    joining_date: string;
    employment_status: DeliveryEmploymentStatus;
    operational_status: DeliveryOperationalStatus;
    address: string | null;
    contact_email: string | null;
    id_proof_type: DeliveryIdProofType | null;
    id_proof_number: string | null;
    primary_service_area_id: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    profile_id: string;
    joining_date?: string;
    employment_status?: DeliveryEmploymentStatus;
    operational_status?: DeliveryOperationalStatus;
    address?: string | null;
    contact_email?: string | null;
    id_proof_type?: DeliveryIdProofType | null;
    id_proof_number?: string | null;
    primary_service_area_id?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<DeliveryEmployment['Insert']>;
  Relationships: [
    {
      foreignKeyName: 'delivery_employment_profile_id_fkey';
      columns: ['profile_id'];
      isOneToOne: true;
      referencedRelation: 'profiles';
      referencedColumns: ['id'];
    },
  ];
};

type Vehicles = {
  Row: {
    id: string;
    vehicle_number: string;
    vehicle_type: string;
    capacity_label: string | null;
    status: VehicleStatusDb;
    is_active: boolean;
    assigned_delivery_profile_id: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  Insert: {
    id?: string;
    vehicle_number: string;
    vehicle_type?: string;
    capacity_label?: string | null;
    status?: VehicleStatusDb;
    is_active?: boolean;
    assigned_delivery_profile_id?: string | null;
    notes?: string | null;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
  };
  Update: Partial<Vehicles['Insert']>;
  Relationships: [
    {
      foreignKeyName: 'vehicles_assigned_delivery_profile_id_fkey';
      columns: ['assigned_delivery_profile_id'];
      isOneToOne: false;
      referencedRelation: 'profiles';
      referencedColumns: ['id'];
    },
  ];
};

type VehicleAssignmentHistory = {
  Row: {
    id: string;
    vehicle_id: string;
    delivery_profile_id: string | null;
    route_id: string | null;
    from_status: VehicleStatusDb | null;
    to_status: VehicleStatusDb;
    note: string | null;
    recorded_by_profile_id: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    vehicle_id: string;
    delivery_profile_id?: string | null;
    route_id?: string | null;
    from_status?: VehicleStatusDb | null;
    to_status: VehicleStatusDb;
    note?: string | null;
    recorded_by_profile_id?: string | null;
    created_at?: string;
  };
  Update: Partial<VehicleAssignmentHistory['Insert']>;
  Relationships: [
    {
      foreignKeyName: 'vehicle_assignment_history_vehicle_id_fkey';
      columns: ['vehicle_id'];
      isOneToOne: false;
      referencedRelation: 'vehicles';
      referencedColumns: ['id'];
    },
  ];
};

type DeliveryTimeSlots = {
  Row: {
    id: string;
    label: string;
    start_time: string;
    end_time: string;
    sort_order: number;
    is_active: boolean;
    created_at: string;
  };
  Insert: {
    id?: string;
    label: string;
    start_time: string;
    end_time: string;
    sort_order?: number;
    is_active?: boolean;
    created_at?: string;
  };
  Update: Partial<DeliveryTimeSlots['Insert']>;
  Relationships: [];
};

type DeliveryScheduleEvents = {
  Row: {
    id: string;
    order_id: string;
    route_id: string | null;
    route_stop_id: string | null;
    kind: DeliveryScheduleEventKind;
    delivery_date: string;
    time_slot_id: string | null;
    delivery_profile_id: string | null;
    vehicle_id: string | null;
    reason: string | null;
    exception_id: string | null;
    recorded_by_profile_id: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    order_id: string;
    route_id?: string | null;
    route_stop_id?: string | null;
    kind: DeliveryScheduleEventKind;
    delivery_date: string;
    time_slot_id?: string | null;
    delivery_profile_id?: string | null;
    vehicle_id?: string | null;
    reason?: string | null;
    exception_id?: string | null;
    recorded_by_profile_id?: string | null;
    created_at?: string;
  };
  Update: Partial<DeliveryScheduleEvents['Insert']>;
  Relationships: [
    {
      foreignKeyName: 'delivery_schedule_events_order_id_fkey';
      columns: ['order_id'];
      isOneToOne: false;
      referencedRelation: 'orders';
      referencedColumns: ['id'];
    },
  ];
};

type DeliveryCodCustody = {
  Row: {
    order_id: string;
    payment_id: string;
    delivery_profile_id: string;
    amount: number;
    status: DeliveryCodCustodyStatus;
    collected_at: string;
    settlement_id: string | null;
    updated_at: string;
    created_at: string;
  };
  Insert: {
    order_id: string;
    payment_id: string;
    delivery_profile_id: string;
    amount: number;
    status?: DeliveryCodCustodyStatus;
    collected_at?: string;
    settlement_id?: string | null;
    updated_at?: string;
    created_at?: string;
  };
  Update: Partial<DeliveryCodCustody['Insert']>;
  Relationships: [
    {
      foreignKeyName: 'delivery_cod_custody_order_id_fkey';
      columns: ['order_id'];
      isOneToOne: true;
      referencedRelation: 'orders';
      referencedColumns: ['id'];
    },
  ];
};

type DeliveryCodSettlements = {
  Row: {
    id: string;
    delivery_profile_id: string;
    amount: number;
    reference: string | null;
    note: string | null;
    status: DeliveryCodCustodyStatus;
    stage: 'FROM_DRIVER' | 'TO_OWNER';
    recorded_by_profile_id: string | null;
    settled_at: string;
    created_at: string;
  };
  Insert: {
    id?: string;
    delivery_profile_id: string;
    amount: number;
    reference?: string | null;
    note?: string | null;
    status?: DeliveryCodCustodyStatus;
    stage?: 'FROM_DRIVER' | 'TO_OWNER';
    recorded_by_profile_id?: string | null;
    settled_at?: string;
    created_at?: string;
  };
  Update: Partial<DeliveryCodSettlements['Insert']>;
  Relationships: [
    {
      foreignKeyName: 'delivery_cod_settlements_delivery_profile_id_fkey';
      columns: ['delivery_profile_id'];
      isOneToOne: false;
      referencedRelation: 'profiles';
      referencedColumns: ['id'];
    },
  ];
};

type DeliveryExceptions = {
  Row: {
    id: string;
    category: DeliveryExceptionCategory;
    reason_code: string;
    reason_note: string | null;
    status: DeliveryExceptionStatus;
    route_id: string | null;
    order_id: string | null;
    route_stop_id: string | null;
    reported_by_profile_id: string | null;
    resolved_by_profile_id: string | null;
    action_taken: DeliveryExceptionAction | null;
    action_note: string | null;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    category: DeliveryExceptionCategory;
    reason_code: string;
    reason_note?: string | null;
    status?: DeliveryExceptionStatus;
    route_id?: string | null;
    order_id?: string | null;
    route_stop_id?: string | null;
    reported_by_profile_id?: string | null;
    resolved_by_profile_id?: string | null;
    action_taken?: DeliveryExceptionAction | null;
    action_note?: string | null;
    resolved_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<DeliveryExceptions['Insert']>;
  Relationships: [];
};

type DeliveryNotificationEvents = {
  Row: {
    id: string;
    order_id: string;
    kind: DeliveryNotificationEventKind;
    message_preview: string;
    outbox_id: string | null;
    provider_configured: boolean;
    payload: Json;
    created_by_profile_id: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    order_id: string;
    kind: DeliveryNotificationEventKind;
    message_preview: string;
    outbox_id?: string | null;
    provider_configured?: boolean;
    payload?: Json;
    created_by_profile_id?: string | null;
    created_at?: string;
  };
  Update: Partial<DeliveryNotificationEvents['Insert']>;
  Relationships: [
    {
      foreignKeyName: 'delivery_notification_events_order_id_fkey';
      columns: ['order_id'];
      isOneToOne: false;
      referencedRelation: 'orders';
      referencedColumns: ['id'];
    },
  ];
};

/** H5 columns on delivery_routes (vehicle + time slot). */
type DeliveryRoutesH5Patch = {
  Row: { vehicle_id: string | null; time_slot_id: string | null };
  Insert: { vehicle_id?: string | null; time_slot_id?: string | null };
  Update: { vehicle_id?: string | null; time_slot_id?: string | null };
};

type DeliveryH5Functions = {
  delivery_provider_configured: {
    Args: Record<string, never>;
    Returns: boolean;
  };
  admin_upsert_delivery_employment: {
    Args: {
      p_profile_id: string;
      p_joining_date?: string | null;
      p_employment_status?: DeliveryEmploymentStatus;
      p_operational_status?: DeliveryOperationalStatus | null;
      p_address?: string | null;
      p_contact_email?: string | null;
      p_id_proof_type?: DeliveryIdProofType | null;
      p_id_proof_number?: string | null;
      p_primary_service_area_id?: string | null;
    };
    Returns: Json;
  };
  admin_upsert_vehicle: {
    Args: {
      p_vehicle_id?: string | null;
      p_vehicle_number?: string | null;
      p_vehicle_type?: string | null;
      p_capacity_label?: string | null;
      p_is_active?: boolean;
      p_status?: VehicleStatusDb | null;
      p_assigned_delivery_profile_id?: string | null;
      p_notes?: string | null;
    };
    Returns: Json;
  };
  admin_schedule_and_assign_delivery: {
    Args: {
      p_order_ids: string[];
      p_delivery_profile_id: string;
      p_vehicle_id: string;
      p_delivery_date: string;
      p_time_slot_id: string;
      p_route_id?: string | null;
      p_service_area_id?: string | null;
    };
    Returns: Json;
  };
  admin_settle_delivery_cod: {
    Args: {
      p_delivery_profile_id: string;
      p_amount: number;
      p_reference?: string | null;
      p_note?: string | null;
    };
    Returns: Json;
  };
  admin_settle_delivery_cod_selected: {
    Args: {
      p_delivery_profile_id: string;
      p_order_ids: string[];
      p_reference?: string | null;
      p_note?: string | null;
    };
    Returns: Json;
  };
  admin_confirm_owner_cod_receipt: {
    Args: {
      p_delivery_profile_id: string;
      p_amount: number;
      p_reference?: string | null;
      p_note?: string | null;
    };
    Returns: Json;
  };
  admin_confirm_owner_cod_receipt_selected: {
    Args: {
      p_delivery_profile_id: string;
      p_order_ids: string[];
      p_reference?: string | null;
      p_note?: string | null;
    };
    Returns: Json;
  };
  admin_reorder_product_images: {
    Args: {
      p_product_id: string;
      p_image_ids: string[];
    };
    Returns: Json;
  };
  admin_soft_delete_product_media: {
    Args: { p_media_id: string };
    Returns: Json;
  };
  admin_create_delivery_exception: {
    Args: {
      p_category: DeliveryExceptionCategory;
      p_reason_code: string;
      p_reason_note?: string | null;
      p_route_id?: string | null;
      p_order_id?: string | null;
      p_route_stop_id?: string | null;
    };
    Returns: Json;
  };
  admin_resolve_delivery_exception: {
    Args: {
      p_exception_id: string;
      p_action: DeliveryExceptionAction;
      p_action_note?: string | null;
      p_replacement_delivery_profile_id?: string | null;
      p_replacement_vehicle_id?: string | null;
      p_new_delivery_date?: string | null;
      p_new_time_slot_id?: string | null;
    };
    Returns: Json;
  };
  admin_recommend_delivery_assignment: {
    Args: {
      p_service_area_id: string;
      p_delivery_date: string;
    };
    Returns: Json;
  };
};

/** Final Admin Dashboard + Payments ops RPCs (20260827140000). */
type AdminDashboardPaymentsFunctions = {
  payment_bank_confirmation_configured: {
    Args: Record<string, never>;
    Returns: boolean;
  };
  admin_ops_dashboard_kpis: {
    Args: { p_today?: string | null };
    Returns: Json;
  };
  admin_salesmen_working_today: {
    Args: { p_today?: string | null };
    Returns: Json;
  };
  admin_payments_overview: {
    Args: { p_today?: string | null };
    Returns: Json;
  };
  admin_manager_cod_custody_breakdown: {
    Args: Record<string, never>;
    Returns: Json;
  };
  admin_sales_dashboard_metrics: {
    Args: { p_as_of_date?: string | null; p_fy_start_month?: number | null };
    Returns: Json;
  };
};

/** Order lifecycle automation RPCs (20260827150000). */
type OrderLifecycleFunctions = {
  admin_create_order_invoice: {
    Args: { p_order_id: string };
    Returns: Json;
  };
  admin_start_packing: {
    Args: { p_order_id: string };
    Returns: string;
  };
  admin_pack_order: {
    Args: { p_order_id: string };
    Returns: Json;
  };
  admin_replace_order_lines: {
    Args: { p_order_id: string; p_lines: Json };
    Returns: Json;
  };
  admin_orders_needing_attention: {
    Args: { p_limit?: number };
    Returns: Json;
  };
  try_auto_assign_delivery: {
    Args: { p_order_id: string };
    Returns: Json;
  };
  try_auto_convert_order_to_sale: {
    Args: { p_order_id: string };
    Returns: Json;
  };
};

/** Customer activation + assisted approval RPCs (20260829120000). */
type CustomerApprovalFunctions = {
  resolve_effective_sku_trade_price: {
    Args: { p_sku_id: string };
    Returns: number;
  };
  customer_approve_assisted_order: {
    Args: { p_token: string };
    Returns: string;
  };
  customer_request_order_changes: {
    Args: { p_token: string; p_reason: string };
    Returns: string;
  };
  reissue_order_approval_challenge: {
    Args: { p_order_id: string };
    Returns: Json;
  };
  salesman_replace_assisted_order_lines: {
    Args: { p_order_id: string; p_lines: Json };
    Returns: Json;
  };
  get_order_approval_by_token: {
    Args: { p_token: string };
    Returns: Json;
  };
  job_expire_order_confirmation_challenges: {
    Args: Record<string, never>;
    Returns: Json;
  };
  job_remind_order_approvals: {
    Args: Record<string, never>;
    Returns: Json;
  };
  ensure_customer_profile_from_auth: {
    Args: Record<string, never>;
    Returns: Json;
  };
  customer_link_verified_mobile: {
    Args: { p_shop_id?: string | null };
    Returns: Json;
  };
  record_customer_app_link_sent: {
    Args: { p_shop_id: string };
    Returns: Json;
  };
  admin_update_shop_primary_contact: {
    Args: {
      p_shop_id: string;
      p_name: string;
      p_mobile: string;
      p_email?: string | null;
      p_acknowledge_activated_change?: boolean;
    };
    Returns: Json;
  };
};

/** Pre-sale invoice columns on orders (20260827150000). */
type OrdersLifecyclePatch = {
  Row: {
    invoice_number?: string | null;
    invoice_created_at?: string | null;
  };
  Insert: {
    invoice_number?: string | null;
    invoice_created_at?: string | null;
  };
  Update: {
    invoice_number?: string | null;
    invoice_created_at?: string | null;
  };
};

/** Cash vs online amount split on payments (20260827160000). */
type PaymentsCashOnlinePatch = {
  Row: {
    cash_collected_amount?: number;
    online_collected_amount?: number;
  };
  Insert: {
    cash_collected_amount?: number;
    online_collected_amount?: number;
  };
  Update: {
    cash_collected_amount?: number;
    online_collected_amount?: number;
  };
};

type ShopsAppLinkPatch = {
  Row: {
    last_app_link_sent_at?: string | null;
    last_app_link_sent_by_profile_id?: string | null;
  };
  Insert: {
    last_app_link_sent_at?: string | null;
    last_app_link_sent_by_profile_id?: string | null;
  };
  Update: {
    last_app_link_sent_at?: string | null;
    last_app_link_sent_by_profile_id?: string | null;
  };
};

type WithSoftDelete<T> = T extends { Row: infer R; Insert: infer I; Update: infer U; Relationships: infer Rel }
  ? {
      Row: R & SoftDelete;
      Insert: I & { deleted_at?: string | null };
      Update: U & { deleted_at?: string | null };
      Relationships: Rel;
    }
  : T;

type SoftDeletedTables = {
  categories: WithSoftDelete<GeneratedDatabase['public']['Tables']['categories']>;
  products: WithSoftDelete<GeneratedDatabase['public']['Tables']['products']>;
  skus: WithSoftDelete<GeneratedDatabase['public']['Tables']['skus']>;
  shops: WithSoftDelete<
    GeneratedDatabase['public']['Tables']['shops'] & ShopsAppLinkPatch
  >;
  delivery_routes: {
    Row: WithSoftDelete<
      GeneratedDatabase['public']['Tables']['delivery_routes']
    >['Row'] &
      DeliveryRoutesH5Patch['Row'];
    Insert: WithSoftDelete<
      GeneratedDatabase['public']['Tables']['delivery_routes']
    >['Insert'] &
      DeliveryRoutesH5Patch['Insert'];
    Update: WithSoftDelete<
      GeneratedDatabase['public']['Tables']['delivery_routes']
    >['Update'] &
      DeliveryRoutesH5Patch['Update'];
    Relationships: GeneratedDatabase['public']['Tables']['delivery_routes']['Relationships'];
  };
  profiles: WithSoftDelete<GeneratedDatabase['public']['Tables']['profiles']>;
  service_areas: WithSoftDelete<
    GeneratedDatabase['public']['Tables']['service_areas']
  >;
  operational_locations: WithSoftDelete<
    GeneratedDatabase['public']['Tables']['operational_locations']
  >;
};

type Sprint4Views = {
  user_profiles: {
    Row: GeneratedDatabase['public']['Tables']['profiles']['Row'] & SoftDelete;
    Relationships: [];
  };
  customers: {
    Row: GeneratedDatabase['public']['Tables']['shops']['Row'] & SoftDelete;
    Relationships: [];
  };
  price_history: {
    Row: GeneratedDatabase['public']['Tables']['sku_prices']['Row'];
    Relationships: [];
  };
  order_items: {
    Row: GeneratedDatabase['public']['Tables']['order_lines']['Row'];
    Relationships: [];
  };
  inventory: {
    Row: GeneratedDatabase['public']['Tables']['inventory_balances']['Row'];
    Relationships: [];
  };
};

export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<
    GeneratedDatabase['public'],
    'Tables' | 'Views' | 'Enums' | 'Functions'
  > & {
    Tables: Omit<
      GeneratedDatabase['public']['Tables'],
      keyof SoftDeletedTables | 'orders' | 'payments'
    > &
      SoftDeletedTables & {
        orders: {
          Row: GeneratedDatabase['public']['Tables']['orders']['Row'] &
            OrdersLifecyclePatch['Row'];
          Insert: GeneratedDatabase['public']['Tables']['orders']['Insert'] &
            OrdersLifecyclePatch['Insert'];
          Update: GeneratedDatabase['public']['Tables']['orders']['Update'] &
            OrdersLifecyclePatch['Update'];
          Relationships: GeneratedDatabase['public']['Tables']['orders']['Relationships'];
        };
        payments: {
          Row: GeneratedDatabase['public']['Tables']['payments']['Row'] &
            PaymentsCashOnlinePatch['Row'];
          Insert: GeneratedDatabase['public']['Tables']['payments']['Insert'] &
            PaymentsCashOnlinePatch['Insert'];
          Update: GeneratedDatabase['public']['Tables']['payments']['Update'] &
            PaymentsCashOnlinePatch['Update'];
          Relationships: GeneratedDatabase['public']['Tables']['payments']['Relationships'];
        };
        product_images: ProductImages;
        customer_addresses: CustomerAddresses;
        settings: Settings;
        reports_snapshot: ReportsSnapshot;
        sales_visits: SalesVisits;
        salesman_attendance: SalesmanAttendance;
        salesman_employment: SalesmanEmployment;
        salesman_salary_terms: SalesmanSalaryTerms;
        sku_commission_terms: {
          Row: {
            id: string;
            sku_id: string;
            fixed_amount_per_unit: number;
            effective_from: string;
            effective_to: string | null;
            created_by_profile_id: string | null;
            created_at: string;
          };
          Insert: {
            id?: string;
            sku_id: string;
            fixed_amount_per_unit: number;
            effective_from: string;
            effective_to?: string | null;
            created_by_profile_id?: string | null;
            created_at?: string;
          };
          Update: Partial<{
            id: string;
            sku_id: string;
            fixed_amount_per_unit: number;
            effective_from: string;
            effective_to: string | null;
            created_by_profile_id: string | null;
            created_at: string;
          }>;
          Relationships: [];
        };
        salesman_commission_entries: {
          Row: {
            id: string;
            salesman_profile_id: string;
            sale_id: string;
            sale_item_id: string;
            order_id: string;
            sku_id: string | null;
            quantity: number;
            unit_commission: number;
            commission_amount: number;
            status: SalesmanCommissionEntryStatus;
            created_at: string;
            reversed_at: string | null;
            reversal_of_entry_id: string | null;
          };
          Insert: {
            id?: string;
            salesman_profile_id: string;
            sale_id: string;
            sale_item_id: string;
            order_id: string;
            sku_id?: string | null;
            quantity: number;
            unit_commission: number;
            commission_amount: number;
            status?: SalesmanCommissionEntryStatus;
            created_at?: string;
            reversed_at?: string | null;
            reversal_of_entry_id?: string | null;
          };
          Update: Partial<{
            id: string;
            salesman_profile_id: string;
            sale_id: string;
            sale_item_id: string;
            order_id: string;
            sku_id: string | null;
            quantity: number;
            unit_commission: number;
            commission_amount: number;
            status: SalesmanCommissionEntryStatus;
            created_at: string;
            reversed_at: string | null;
            reversal_of_entry_id: string | null;
          }>;
          Relationships: [];
        };
        company_holidays: CompanyHolidays;
        delivery_employment: DeliveryEmployment;
        vehicles: Vehicles;
        vehicle_assignment_history: VehicleAssignmentHistory;
        delivery_time_slots: DeliveryTimeSlots;
        delivery_schedule_events: DeliveryScheduleEvents;
        delivery_cod_custody: DeliveryCodCustody;
        delivery_cod_settlements: DeliveryCodSettlements;
        delivery_exceptions: DeliveryExceptions;
        delivery_notification_events: DeliveryNotificationEvents;
      };
    Views: GeneratedDatabase['public']['Views'] & Sprint4Views;
    Functions: GeneratedDatabase['public']['Functions'] &
      Sprint7Functions &
      Sprint8Functions &
      Sprint9Functions &
      DeliveryH5Functions &
      AdminDashboardPaymentsFunctions &
      OrderLifecycleFunctions &
      CustomerApprovalFunctions;
    Enums: Omit<GeneratedDatabase['public']['Enums'], 'staff_role'> & {
      staff_role:
        | 'CUSTOMER'
        | 'SALESMAN'
        | 'DELIVERY'
        | 'ADMIN'
        | 'READ_ONLY';
      sales_visit_status: SalesVisitStatus;
      salesman_attendance_status: SalesmanAttendanceStatus;
      salesman_employment_status: SalesmanEmploymentStatus;
      salesman_earning_model: SalesmanEarningModel;
      salesman_commission_entry_status: SalesmanCommissionEntryStatus;
      salesman_id_proof_type: SalesmanIdProofType;
      delivery_employment_status: DeliveryEmploymentStatus;
      delivery_operational_status: DeliveryOperationalStatus;
      delivery_id_proof_type: DeliveryIdProofType;
      vehicle_status: VehicleStatusDb;
      delivery_schedule_event_kind: DeliveryScheduleEventKind;
      delivery_cod_custody_status: DeliveryCodCustodyStatus;
      delivery_exception_category: DeliveryExceptionCategory;
      delivery_exception_status: DeliveryExceptionStatus;
      delivery_exception_action: DeliveryExceptionAction;
      delivery_notification_event_kind: DeliveryNotificationEventKind;
    };
  };
};
