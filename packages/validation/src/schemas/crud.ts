import { z } from 'zod';
import { OPERATIONAL_LOCATION_KINDS, SELLING_UNITS } from '@groaurum/shared-types';

export const uuidSchema = z.string().uuid();

export const nonEmptyString = z.string().trim().min(1);

export const pinCodeSchema = z
  .string()
  .regex(/^[0-9]{6}$/, 'PIN code must be 6 digits');

/** Split pasted PIN lists (newlines, commas, or whitespace) into tokens. */
export function parsePinCodeList(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((pin) => pin.trim())
    .filter((pin) => pin.length > 0);
}

export const pinCodesSchema = z
  .array(pinCodeSchema)
  .min(1, 'At least one PIN code is required')
  .superRefine((pins, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < pins.length; i += 1) {
      if (seen.has(pins[i])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'PIN codes must be unique',
          path: [i],
        });
      }
      seen.add(pins[i]);
    }
  });

export const moneySchema = z.number().finite().nonnegative();

export const quantitySchema = z.number().finite().positive();

export const discountTypeSchema = z.enum(['none', 'percent', 'fixed']);
export const containerPriceModeSchema = z.enum(['calculated', 'custom']);

/** Normalize Indian mobiles to E.164 (+91XXXXXXXXXX) to match DB CHECK constraints. */
export function normalizeIndianMobile(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
  if (trimmed.startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  throw new Error('unsupported mobile format');
}

export const indianMobileSchema = z
  .string()
  .trim()
  .min(1, 'Mobile is required')
  .transform((value, ctx) => {
    try {
      return normalizeIndianMobile(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid 10-digit Indian mobile number',
      });
      return z.NEVER;
    }
  });

export const optionalEmailSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .pipe(z.string().email('Enter a valid email').optional());

export const categoryCreateSchema = z.object({
  name: nonEmptyString,
  description: z.string().trim().optional(),
  displayOrder: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const productCreateSchema = z.object({
  categoryId: uuidSchema,
  name: nonEmptyString,
  description: z.string().trim().optional(),
  productType: z.enum(['PACKED', 'BULK']),
  imageUrls: z.array(z.string().url()).optional(),
  isActive: z.boolean().optional(),
});

export const productUpdateSchema = productCreateSchema.partial();

const skuCoreFields = {
  skuCode: nonEmptyString,
  name: nonEmptyString,
  specification: z.string().optional(),
  grade: z.string().optional(),
  productType: z.enum(['PACKED', 'BULK']),
  sellingUnit: z
    .string()
    .trim()
    .min(1, 'Selling unit is required')
    .max(40, 'Selling unit must be at most 40 characters')
    .transform((v) => {
      const upper = v.toUpperCase();
      return (SELLING_UNITS as readonly string[]).includes(upper) ? upper : v;
    }),
  netQuantity: z.number().positive().optional(),
  netQuantityUnit: z.string().optional(),
  packsPerCarton: z.number().int().positive().optional(),
  outerType: z
    .enum(['box', 'carton', 'case', 'crate', 'bundle', 'bag'])
    .optional(),
  moq: quantitySchema.optional(),
  quantityStep: quantitySchema.optional(),
  isActive: z.boolean().optional(),
  packDiscountType: discountTypeSchema.optional(),
  packDiscountValue: moneySchema.optional(),
  containerPriceMode: containerPriceModeSchema.optional(),
  containerCustomPrice: moneySchema.nullable().optional(),
  containerDiscountType: discountTypeSchema.optional(),
  containerDiscountValue: moneySchema.optional(),
  /** HSN code for GST (4–8 digits typical). */
  hsnCode: z.string().trim().min(4).max(8).optional().nullable(),
  /** GST rate percent (e.g. 5, 12, 18). */
  gstRatePercent: z.number().min(0).max(100).optional().nullable(),
} as const;

function refineSkuDiscounts(
  data: {
    packDiscountType?: 'none' | 'percent' | 'fixed';
    packDiscountValue?: number;
    containerDiscountType?: 'none' | 'percent' | 'fixed';
    containerDiscountValue?: number;
    containerPriceMode?: 'calculated' | 'custom';
    containerCustomPrice?: number | null;
  },
  ctx: z.RefinementCtx,
) {
  const packType = data.packDiscountType ?? 'none';
  const packValue = data.packDiscountValue ?? 0;
  if (packType === 'percent' && packValue > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Pack percentage discount cannot exceed 100%',
      path: ['packDiscountValue'],
    });
  }
  const containerType = data.containerDiscountType ?? 'none';
  const containerValue = data.containerDiscountValue ?? 0;
  if (containerType === 'percent' && containerValue > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Container percentage discount cannot exceed 100%',
      path: ['containerDiscountValue'],
    });
  }
  if (
    data.containerPriceMode === 'custom' &&
    (data.containerCustomPrice == null || data.containerCustomPrice < 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Custom container price is required when using custom bag pricing',
      path: ['containerCustomPrice'],
    });
  }
}

export const skuCreateSchema = z
  .object({
    productId: uuidSchema,
    ...skuCoreFields,
  })
  .superRefine(refineSkuDiscounts);

export const skuUpdateSchema = z
  .object(skuCoreFields)
  .partial()
  .superRefine(refineSkuDiscounts);

/** Admin Set/Update Price — effective_from is always "now" via trusted RPC. */
export const priceCreateSchema = z.object({
  skuId: uuidSchema,
  tradePrice: moneySchema,
  currency: z.string().length(3).default('INR'),
  recordedByProfileId: uuidSchema.optional(),
});

export const priceTierInputSchema = z.object({
  minQuantity: z.number().positive(),
  unitPrice: moneySchema,
});

export const priceTiersSetSchema = z.object({
  skuId: uuidSchema,
  tiers: z.array(priceTierInputSchema),
  recordedByProfileId: uuidSchema.optional(),
});

export const inventoryAdjustSchema = z.object({
  skuId: uuidSchema,
  operationalLocationId: uuidSchema,
  onHandQuantity: z.number().finite().nonnegative(),
  reason: z.string().trim().min(1).optional(),
  actorProfileId: uuidSchema.optional(),
});

export const customerCreateSchema = z.object({
  tradeName: nonEmptyString,
  legalName: z.string().trim().optional(),
  ownerName: nonEmptyString,
  ownerMobile: indianMobileSchema,
  ownerEmail: optionalEmailSchema,
  serviceAreaId: uuidSchema,
  assignedSalesmanProfileId: uuidSchema,
  deliveryAddressLine: nonEmptyString,
  deliveryCity: nonEmptyString,
  deliveryState: nonEmptyString,
  deliveryPinCode: pinCodeSchema,
  deliveryLat: z.number().min(-90).max(90).optional(),
  deliveryLng: z.number().min(-180).max(180).optional(),
  isActive: z.boolean().optional(),
  /** Optional customer GSTIN (structural format checked in admin UI). */
  gstin: z.string().trim().max(20).optional().nullable(),
});

export const customerUpdateSchema = z.object({
  tradeName: nonEmptyString,
  legalName: z.string().trim().optional(),
  serviceAreaId: uuidSchema.nullable(),
  assignedSalesmanProfileId: uuidSchema.nullable(),
  deliveryAddressLine: nonEmptyString,
  deliveryCity: nonEmptyString,
  deliveryState: nonEmptyString,
  deliveryPinCode: pinCodeSchema,
  deliveryLat: z.number().min(-90).max(90).optional(),
  deliveryLng: z.number().min(-180).max(180).optional(),
  isActive: z.boolean().optional(),
  gstin: z.string().trim().max(20).optional().nullable(),
}).partial();

export const customerContactUpdateSchema = z.object({
  ownerName: nonEmptyString,
  ownerMobile: indianMobileSchema,
  ownerEmail: optionalEmailSchema,
  acknowledgeActivatedChange: z.boolean().optional(),
});

export const customerAddressCreateSchema = z.object({
  shopId: uuidSchema,
  label: nonEmptyString.optional(),
  addressLine: nonEmptyString,
  city: nonEmptyString,
  state: nonEmptyString,
  pinCode: pinCodeSchema,
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional(),
});

export const orderCreateSchema = z.object({
  shopId: uuidSchema,
  serviceAreaId: uuidSchema,
  source: z.enum(['CUSTOMER_SELF_SERVE', 'SALESMAN_ASSISTED']),
  createdByProfileId: uuidSchema,
  expectedDeliveryAt: z.string().datetime().optional().nullable(),
  lines: z
    .array(
      z.object({
        skuId: uuidSchema,
        quantity: quantitySchema,
        agreedUnitPrice: moneySchema,
      }),
    )
    .min(1),
});

export const salesmanCreateSchema = z.object({
  displayName: nonEmptyString,
  mobile: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Mobile must be normalized digits'),
  authUserId: uuidSchema,
  isActive: z.boolean().optional(),
});

/** Admin H3: Auth-backed provision (edge function). No authUserId — server creates it. */
export const salesmanProvisionSchema = z.object({
  displayName: nonEmptyString,
  mobile: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Mobile must be normalized digits'),
  email: z.string().email('Valid email is required'),
  temporaryPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
  isActive: z.boolean().optional(),
});

/** Delivery H5: same shape as salesman provision (provision-delivery edge). */
export const deliveryProvisionSchema = salesmanProvisionSchema;

/** Salesman H4: employment terms (trusted RPC). */
export const salesmanEmploymentUpsertSchema = z.object({
  profileId: uuidSchema,
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  employmentStatus: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  address: z.string().trim().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  idProofType: z.enum(['AADHAAR', 'PAN', 'OTHER']).optional().nullable(),
  idProofNumber: z.string().trim().optional(),
  primaryServiceAreaId: uuidSchema.optional().nullable(),
  weeklyOffDow: z.number().int().min(0).max(6),
  workingDays: z.array(z.number().int().min(0).max(6)).min(1),
});

/** Salesman H4: append-only salary terms. */
export const salesmanSalaryTermsSchema = z.object({
  profileId: uuidSchema,
  monthlySalary: moneySchema,
  dailyAllowance: moneySchema.optional(),
  otherAllowance: moneySchema.optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Salesman H4: admin attendance set/correct. */
export const salesmanAttendanceSetSchema = z.object({
  profileId: uuidSchema,
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum([
    'PRESENT',
    'ABSENT',
    'PAID_LEAVE',
    'UNPAID_LEAVE',
    'HOLIDAY',
    'WEEKLY_OFF',
  ]),
  reason: z.string().trim().optional(),
});

export const companyHolidayUpsertSchema = z.object({
  holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: nonEmptyString,
  serviceAreaId: uuidSchema.optional().nullable(),
  holidayId: uuidSchema.optional(),
});

export const deliveryRouteCreateSchema = z.object({
  serviceAreaId: uuidSchema,
  routeDate: z.string().min(1),
  assignedDeliveryProfileId: uuidSchema.optional().nullable(),
  status: z
    .enum(['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
    .optional(),
});

export const deliveryRouteUpdateSchema = deliveryRouteCreateSchema.partial();

export const settingUpsertSchema = z.object({
  settingKey: nonEmptyString,
  settingValue: z.record(z.unknown()),
  description: z.string().optional(),
  updatedByProfileId: uuidSchema.optional().nullable(),
});

/** Prefer companySettingUpsertSchema when persisting the company profile document. */

export const serviceAreaCreateSchema = z.object({
  name: nonEmptyString,
  description: z.string().trim().optional(),
  displayOrder: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export const serviceAreaUpdateSchema = serviceAreaCreateSchema.partial();

export const serviceabilityRuleCreateSchema = z.object({
  serviceAreaId: uuidSchema,
  ruleType: z.literal('PIN_CODE'),
  pinCodes: pinCodesSchema,
  isActive: z.boolean().optional(),
});

export const serviceabilityRuleUpdateSchema = z.object({
  pinCodes: pinCodesSchema.optional(),
  isActive: z.boolean().optional(),
});

export const warehouseCreateSchema = z.object({
  name: nonEmptyString,
  addressLine: nonEmptyString,
  city: nonEmptyString,
  state: nonEmptyString,
  pinCode: pinCodeSchema,
  kind: z.enum(OPERATIONAL_LOCATION_KINDS).optional(),
  lat: z.number().finite().min(-90).max(90).optional().nullable(),
  lng: z.number().finite().min(-180).max(180).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const warehouseUpdateSchema = warehouseCreateSchema.partial();

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type SkuCreateInput = z.infer<typeof skuCreateSchema>;
export type SkuUpdateInput = z.infer<typeof skuUpdateSchema>;
export type PriceCreateInput = z.infer<typeof priceCreateSchema>;
export type PriceTiersSetInput = z.infer<typeof priceTiersSetSchema>;
export type InventoryAdjustInput = z.infer<typeof inventoryAdjustSchema>;
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
export type CustomerContactUpdateInput = z.infer<typeof customerContactUpdateSchema>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type SalesmanCreateInput = z.infer<typeof salesmanCreateSchema>;
export type SalesmanProvisionInput = z.infer<typeof salesmanProvisionSchema>;
export type DeliveryProvisionInput = z.infer<typeof deliveryProvisionSchema>;
export type SalesmanEmploymentUpsertInput = z.infer<
  typeof salesmanEmploymentUpsertSchema
>;
export type SalesmanSalaryTermsInput = z.infer<typeof salesmanSalaryTermsSchema>;
export type SalesmanAttendanceSetInput = z.infer<
  typeof salesmanAttendanceSetSchema
>;
export type CompanyHolidayUpsertInput = z.infer<typeof companyHolidayUpsertSchema>;
export type DeliveryRouteCreateInput = z.infer<typeof deliveryRouteCreateSchema>;
export type DeliveryRouteUpdateInput = z.infer<typeof deliveryRouteUpdateSchema>;
export type SettingUpsertInput = z.infer<typeof settingUpsertSchema>;
export type ServiceAreaCreateInput = z.infer<typeof serviceAreaCreateSchema>;
export type ServiceAreaUpdateInput = z.infer<typeof serviceAreaUpdateSchema>;
export type ServiceabilityRuleCreateInput = z.infer<
  typeof serviceabilityRuleCreateSchema
>;
export type ServiceabilityRuleUpdateInput = z.infer<
  typeof serviceabilityRuleUpdateSchema
>;
export type WarehouseCreateInput = z.infer<typeof warehouseCreateSchema>;
export type WarehouseUpdateInput = z.infer<typeof warehouseUpdateSchema>;
