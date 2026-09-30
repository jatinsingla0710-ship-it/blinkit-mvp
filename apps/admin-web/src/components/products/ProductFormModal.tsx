import { useEffect, useMemo, useState } from 'react';
import { Modal, SelectField, TextField, Button } from '@groaurum/ui';
import type { ProductDetail, ProductTypeVm } from '@/data/product-types';
import { useCategoriesListQuery, useWarehousesListQuery } from '@/data/hooks';
import { formatMutationError } from '@/data/mutation-errors';
import { autoSkuDisplayName, suggestSkuCode } from '@/data/product-create-helpers';
import {
  OUTER_PACKAGE_OPTIONS,
  OUTER_PACKAGES,
  deriveSellingUnitCode,
  formatPackLabel,
  isPriceBasisCompatible,
  minimumOrderSummary,
  mixedInventorySummary,
  mixedStockToPacks,
  moqToBasePacks,
  moqUnitOptions,
  outerPackagingSummary,
  packUnitPluralLabel,
  packUnitsByCategory,
  type OuterPackageKey,
  type PackUnitKey,
  type PriceBasis,
} from '@/data/pack-units';
import {
  boxValueFromPacks,
  defaultPriceBasisForPackUnit,
  packTradePriceFromBasis,
  packsPerOuterFromCount,
  priceBasisLabel,
  priceBasesForPackUnit,
} from '@/data/sku-pack-pricing';
import {
  useCreatePriceMutation,
  useCreateProductMutation,
  useCreateSkuMutation,
  useEnsureCategoryMutation,
  useSetSkuOuterDiscountTiersMutation,
  useUpdateInventoryMutation,
  useUpdateProductMutation,
  useUpdateSkuMutation,
  useUploadProductMediaMutation,
} from '@/data/mutations';
import {
  EMPTY_PRODUCT_FORM,
  formStateFromProductDetail,
  skuDiscountPayloadFromForm,
  type MoqUnitValue,
  type ProductConfigurationFormState,
} from '@/data/product-form-state';
import {
  ProductPricingDiscountSection,
  outerDiscountTiersFromForm,
  packLabelFromForm,
} from '@/components/products/ProductPricingDiscountSection';
import {
  validateOuterDiscountTiers,
} from '@groaurum/catalogue-display';
import { ProductImagesTab } from '@/components/products/ProductImagesTab';
import './ProductFormModal.css';

export type ProductFormMode = 'create' | 'edit';

type Props = {
  open: boolean;
  mode: ProductFormMode;
  product?: ProductDetail | null;
  /** Prefill category when creating from a category detail page. */
  initialCategoryId?: string;
  onClose: () => void;
  onCreated?: (productId: string) => void;
};

type FormState = ProductConfigurationFormState;

const EMPTY = EMPTY_PRODUCT_FORM;

const CREATE_STEPS = [
  'Product',
  'Selling pack',
  'Pricing',
  'Inventory',
  'Publish',
] as const;

const EDIT_STEPS = ['Product', 'Selling pack', 'Pricing', 'Review'] as const;

function resetMoqUnitIfNeeded(
  next: FormState,
  packsPerOuter: number | null,
): FormState {
  const options = moqUnitOptions({
    packUnit: next.packUnit,
    packsPerOuter,
    outerType: next.outerType,
  });
  if (options.some((o) => o.value === next.moqUnit)) return next;
  return { ...next, moqUnit: 'packs' };
}

/**
 * Create / edit product modal — single configuration model for both modes.
 * Create = Product → Selling Pack → Price → Inventory → Publish.
 * Edit = Product → Selling Pack → Price → Review (same SKU fields as create).
 */
export function ProductFormModal({
  open,
  mode,
  product,
  initialCategoryId,
  onClose,
  onCreated,
}: Props) {
  const { data: categories = [] } = useCategoriesListQuery();
  const { data: warehouses = [] } = useWarehousesListQuery();
  const createProduct = useCreateProductMutation();
  const updateProduct = useUpdateProductMutation();
  const updateSku = useUpdateSkuMutation();
  const createSku = useCreateSkuMutation();
  const createPrice = useCreatePriceMutation();
  const createInventory = useUpdateInventoryMutation();
  const uploadMedia = useUploadProductMediaMutation();
  const ensureCategory = useEnsureCategoryMutation();
  const setOuterDiscountTiers = useSetSkuOuterDiscountTiersMutation();
  const [step, setStep] = useState(1);
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectableCategories = useMemo(
    () => categories.filter((c) => c.status === 'active'),
    [categories],
  );
  const activeWarehouses = useMemo(
    () => warehouses.filter((w) => w.status === 'active'),
    [warehouses],
  );
  const unitGroups = useMemo(() => packUnitsByCategory(), []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(null);
    setSaving(false);
    setStep(1);
    setPendingImages([]);
    if (mode === 'edit' && product) {
      const primarySku =
        product.skus.find((sku) => sku.isActive) ?? product.skus[0];
      setEditingSkuId(primarySku?.id ?? null);
      setForm(formStateFromProductDetail(product, primarySku));
    } else {
      setEditingSkuId(null);
      const preferred =
        selectableCategories.find((c) => c.id === initialCategoryId) ??
        selectableCategories[0];
      const firstWh = activeWarehouses[0];
      setForm({
        ...EMPTY,
        categoryId: preferred?.id ?? '',
        warehouseId: firstWh?.id ?? '',
      });
    }
  }, [
    open,
    mode,
    product,
    initialCategoryId,
    selectableCategories,
    activeWarehouses,
  ]);

  const packQty = Number(form.packQuantity);
  const skuName = autoSkuDisplayName(form.name, packQty, form.packUnit);
  const packWord = packUnitPluralLabel(form.packUnit, 2);
  const packWordOne = packUnitPluralLabel(form.packUnit, 1);
  const basisOptions = priceBasesForPackUnit(form.packUnit);

  const livePack = useMemo(() => {
    const basisPrice = Number(form.basisPrice);
    const outerQty = Number(form.outerPackQty);
    let packTradePrice: number | null = null;
    let packError: string | null = null;
    if (
      Number.isFinite(basisPrice) &&
      basisPrice > 0 &&
      Number.isFinite(packQty) &&
      packQty > 0
    ) {
      const converted = packTradePriceFromBasis({
        basisPrice,
        priceBasis: form.priceBasis,
        packQuantity: packQty,
        packUnit: form.packUnit,
      });
      if ('error' in converted) packError = converted.error;
      else packTradePrice = converted.packTradePrice;
    }

    let packsPerOuter: number | null = null;
    let boxError: string | null = null;
    let boxValue: number | null = null;
    let outerSummary: { packsLine: string; contentsLine: string | null } | null =
      null;

    if (form.outerPackQty.trim() !== '') {
      const packs = packsPerOuterFromCount(outerQty);
      if ('error' in packs) boxError = packs.error;
      else {
        packsPerOuter = packs.packsPerBox;
        outerSummary = outerPackagingSummary({
          packQuantity: packQty,
          packUnit: form.packUnit,
          packsPerOuter,
          outerType: form.outerType,
        });
        if (packTradePrice != null) {
          const value = boxValueFromPacks({
            packTradePrice,
            packsPerBox: packsPerOuter,
          });
          if (!('error' in value)) boxValue = value.boxValue;
        }
      }
    }

    return {
      packTradePrice,
      packError,
      packsPerOuter,
      boxError,
      boxValue,
      outerSummary,
    };
  }, [form, packQty]);

  const moqOptions = useMemo(
    () =>
      moqUnitOptions({
        packUnit: form.packUnit,
        packsPerOuter: livePack.packsPerOuter,
        outerType: form.outerType,
      }),
    [form.packUnit, form.outerType, livePack.packsPerOuter],
  );

  const moqConverted = useMemo(() => {
    const qty = Number(form.moq);
    if (!Number.isFinite(qty) || qty <= 0) return null;
    return moqToBasePacks({
      quantity: qty,
      moqUnit: form.moqUnit,
      packsPerOuter: livePack.packsPerOuter,
    });
  }, [form.moq, form.moqUnit, livePack.packsPerOuter]);

  const hasInventoryInput =
    form.initialOuterQty.trim() !== '' || form.initialLooseQty.trim() !== '';

  const inventoryConverted = useMemo(() => {
    if (!hasInventoryInput) return null;
    const outerRaw = form.initialOuterQty.trim();
    const looseRaw = form.initialLooseQty.trim();
    return mixedStockToPacks({
      outerCount: outerRaw === '' ? 0 : Number(outerRaw),
      loosePacks: looseRaw === '' ? 0 : Number(looseRaw),
      packsPerOuter: livePack.packsPerOuter,
    });
  }, [
    hasInventoryInput,
    form.initialOuterQty,
    form.initialLooseQty,
    livePack.packsPerOuter,
  ]);

  const maxStep = mode === 'edit' ? EDIT_STEPS.length : CREATE_STEPS.length;

  const pending =
    saving ||
    createProduct.isPending ||
    updateProduct.isPending ||
    updateSku.isPending ||
    createSku.isPending ||
    createPrice.isPending ||
    createInventory.isPending ||
    ensureCategory.isPending ||
    setOuterDiscountTiers.isPending;

  const validateStep1 = (): string | null => {
    if (!form.name.trim()) return 'Product name is required';
    if (form.categoryInputMode === 'new') {
      if (!form.newCategoryName.trim()) return 'Category name is required';
      return null;
    }
    if (!form.categoryId) {
      return selectableCategories.length === 0
        ? 'No active categories available — create a category or enter a new one'
        : 'Category is required';
    }
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!Number.isFinite(packQty) || packQty <= 0) {
      return 'Pack size must be greater than zero';
    }
    if (!form.skuCode.trim()) return 'SKU code is required';
    if (form.outerPackQty.trim() !== '') {
      if (livePack.boxError) return livePack.boxError;
      if (livePack.packsPerOuter == null || livePack.packsPerOuter <= 0) {
        return 'Outer packaging quantity must be greater than zero';
      }
    }
    if (!moqConverted || 'error' in moqConverted) {
      return moqConverted && 'error' in moqConverted
        ? moqConverted.error
        : 'Minimum order must be a positive number';
    }
    return null;
  };

  const validateStep3 = (): string | null => {
    if (form.basisPrice.trim() === '') {
      return 'Price is required';
    }
    const basisPrice = Number(form.basisPrice);
    if (!Number.isFinite(basisPrice) || basisPrice <= 0) {
      return 'Price must be greater than zero';
    }
    if (!isPriceBasisCompatible(form.packUnit, form.priceBasis)) {
      return `Price basis is not valid for pack unit ${form.packUnit}`;
    }
    if (livePack.packError) return livePack.packError;
    if (livePack.packTradePrice == null) {
      return 'Could not calculate pack price';
    }

    if (livePack.packsPerOuter != null && livePack.packsPerOuter > 0) {
      const containerRegular =
        form.containerPriceMode === 'custom'
          ? Number(form.containerCustomPrice)
          : livePack.packTradePrice * livePack.packsPerOuter;
      if (
        form.containerPriceMode === 'custom' &&
        (!Number.isFinite(containerRegular) || containerRegular < 0)
      ) {
        return 'Custom container price is required';
      }
      const tiers = outerDiscountTiersFromForm(form.outerDiscountTiers);
      const tierErr = validateOuterDiscountTiers(tiers);
      if (tierErr?.includes('cannot be negative') || tierErr?.includes('greater than zero') || tierErr?.includes('Duplicate')) {
        return tierErr;
      }
      for (const tier of tiers) {
        if (tier.discountPerOuterUnit > containerRegular) {
          return `Discount per outer unit cannot exceed ${containerRegular}`;
        }
      }
    }
    return null;
  };

  const validateStep4 = (): string | null => {
    if (!hasInventoryInput) return null;
    if (!form.warehouseId) {
      return 'Select a warehouse for initial inventory';
    }
    if (!inventoryConverted || 'error' in inventoryConverted) {
      return inventoryConverted && 'error' in inventoryConverted
        ? inventoryConverted.error
        : 'Enter valid inventory quantities';
    }
    return null;
  };

  const goNext = () => {
    setError(null);
    if (mode === 'edit' && step === 3) {
      const err = validateStep3();
      if (err) {
        setError(err);
        return;
      }
      setStep(4);
      return;
    }
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        setError(err);
        return;
      }
      setForm((f) => {
        const qty = Number(f.packQuantity);
        const code =
          f.skuCode.trim() || suggestSkuCode(f.name, qty, f.packUnit);
        const nextBasis = isPriceBasisCompatible(f.packUnit, f.priceBasis)
          ? f.priceBasis
          : defaultPriceBasisForPackUnit(f.packUnit);
        return {
          ...f,
          skuCode: code,
          priceBasis: nextBasis,
        };
      });
      setStep(2);
      return;
    }
    if (step === 2) {
      const err = validateStep2();
      if (err) {
        setError(err);
        return;
      }
      setForm((f) => {
        const nextBasis = isPriceBasisCompatible(f.packUnit, f.priceBasis)
          ? f.priceBasis
          : defaultPriceBasisForPackUnit(f.packUnit);
        return { ...f, priceBasis: nextBasis };
      });
      setStep(3);
      return;
    }
    if (step === 3) {
      const err = validateStep3();
      if (err) {
        setError(err);
        return;
      }
      setStep(4);
      return;
    }
    if (step === 4) {
      const err = validateStep4();
      if (err) {
        setError(err);
        return;
      }
      setStep(5);
    }
  };

  const resolveCategoryId = async (): Promise<string> => {
    if (form.categoryInputMode === 'new') {
      return ensureCategory.mutateAsync(form.newCategoryName.trim());
    }
    return form.categoryId;
  };

  const saveOuterDiscountTiers = async (skuId: string) => {
    if (livePack.packsPerOuter == null || livePack.packsPerOuter <= 0) return;
    const tiers = outerDiscountTiersFromForm(form.outerDiscountTiers);
    await setOuterDiscountTiers.mutateAsync({ skuId, tiers });
  };

  const onSubmitEdit = async () => {
    if (!product) return;
    const err1 = validateStep1();
    const err2 = validateStep2();
    const err3 = validateStep3();
    const err = err1 ?? err2 ?? err3;
    if (err) {
      setError(err);
      if (err1) setStep(1);
      else if (err2) setStep(2);
      else setStep(3);
      return;
    }
    if (!moqConverted || 'error' in moqConverted) {
      setError(
        moqConverted && 'error' in moqConverted
          ? moqConverted.error
          : 'Invalid minimum order',
      );
      setStep(2);
      return;
    }
    if (livePack.packTradePrice == null) {
      setError('Could not calculate pack price');
      setStep(3);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const categoryId = await resolveCategoryId();
      await updateProduct.mutateAsync({
        id: product.id,
        input: {
          name: form.name.trim(),
          categoryId,
          description: form.description.trim() || undefined,
          productType: form.productType,
          isActive: form.isActive,
        },
      });

      const packsPerCarton =
        livePack.packsPerOuter != null ? livePack.packsPerOuter : undefined;
      const skuPayload = {
        skuCode: form.skuCode.trim(),
        name: skuName || autoSkuDisplayName(form.name, packQty, form.packUnit),
        productType: 'PACKED' as const,
        sellingUnit: deriveSellingUnitCode(form.packUnit),
        netQuantity: packQty,
        netQuantityUnit: form.packUnit,
        packsPerCarton,
        outerType: form.outerPackQty.trim() !== '' ? form.outerType : undefined,
        moq: moqConverted.packs,
        quantityStep: 1,
        isActive: true,
        ...skuDiscountPayloadFromForm(form),
      };

      if (editingSkuId) {
        await updateSku.mutateAsync({
          id: editingSkuId,
          productId: product.id,
          input: skuPayload,
        });
        await createPrice.mutateAsync({
          skuId: editingSkuId,
          tradePrice: livePack.packTradePrice,
          currency: 'INR',
        });
        await saveOuterDiscountTiers(editingSkuId);
      } else {
        const skuRow = await createSku.mutateAsync({
          productId: product.id,
          ...skuPayload,
        });
        await createPrice.mutateAsync({
          skuId: skuRow.id,
          tradePrice: livePack.packTradePrice,
          currency: 'INR',
        });
        await saveOuterDiscountTiers(skuRow.id);
      }

      setSuccess('Product updated');
      onClose();
    } catch (e) {
      setError(formatMutationError(e, 'Update failed'));
    } finally {
      setSaving(false);
    }
  };

  const onSubmitCreate = async (publish: boolean) => {
    const err1 = validateStep1();
    if (err1) {
      setError(err1);
      setStep(1);
      return;
    }
    const err2 = validateStep2();
    if (err2) {
      setError(err2);
      setStep(2);
      return;
    }
    const err3 = validateStep3();
    if (err3) {
      setError(err3);
      setStep(3);
      return;
    }
    const err4 = validateStep4();
    if (err4) {
      setError(err4);
      setStep(4);
      return;
    }

    if (!moqConverted || 'error' in moqConverted) {
      setError(
        moqConverted && 'error' in moqConverted
          ? moqConverted.error
          : 'Invalid minimum order',
      );
      setStep(2);
      return;
    }

    const onHandPacks =
      hasInventoryInput &&
      inventoryConverted &&
      !('error' in inventoryConverted)
        ? inventoryConverted.onHandPacks
        : undefined;

    setError(null);
    setSaving(true);
    try {
      const categoryId = await resolveCategoryId();
      const productRow = await createProduct.mutateAsync({
        name: form.name.trim(),
        categoryId,
        description: form.description.trim() || undefined,
        productType: form.productType,
        isActive: publish,
      });

      const packsPerCarton =
        livePack.packsPerOuter != null ? livePack.packsPerOuter : undefined;
      const skuRow = await createSku.mutateAsync({
        productId: productRow.id,
        skuCode: form.skuCode.trim(),
        name: skuName || autoSkuDisplayName(form.name, packQty, form.packUnit),
        productType: 'PACKED',
        sellingUnit: deriveSellingUnitCode(form.packUnit),
        netQuantity: packQty,
        netQuantityUnit: form.packUnit,
        packsPerCarton,
        outerType: form.outerType,
        moq: moqConverted.packs,
        quantityStep: 1,
        isActive: true,
        ...skuDiscountPayloadFromForm(form),
      });

      await createPrice.mutateAsync({
        skuId: skuRow.id,
        tradePrice: livePack.packTradePrice!,
        currency: 'INR',
      });

      await saveOuterDiscountTiers(skuRow.id);

      if (onHandPacks != null && form.warehouseId) {
        await createInventory.mutateAsync({
          input: {
            skuId: skuRow.id,
            operationalLocationId: form.warehouseId,
            onHandQuantity: onHandPacks,
            reason: 'Initial balance',
          },
        });
      }

      for (const file of pendingImages.slice(0, 4)) {
        await uploadMedia.mutateAsync({
          productId: productRow.id,
          file,
          mediaKind: 'IMAGE',
        });
      }

      setSuccess(publish ? 'Product created & published' : 'Product saved as draft');
      onCreated?.(productRow.id);
      onClose();
    } catch (e) {
      setError(formatMutationError(e, 'Create failed'));
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode === 'edit'
      ? step === 1
        ? 'Edit Product — Details'
        : step === 2
          ? 'Edit Product — Selling Pack'
          : step === 3
            ? 'Edit Product — Price'
            : 'Edit Product — Review'
      : step === 1
        ? 'Create Product — Details'
        : step === 2
          ? 'Create Product — Selling Pack'
          : step === 3
            ? 'Create Product — Price'
            : step === 4
              ? 'Create Product — Inventory'
              : 'Create Product — Review';

  const categoryName =
    form.categoryInputMode === 'new'
      ? form.newCategoryName.trim() || '—'
      : selectableCategories.find((c) => c.id === form.categoryId)?.name ?? '—';
  const warehouseName =
    activeWarehouses.find((w) => w.id === form.warehouseId)?.name ?? '—';

  const applyPackQuantityChange = (packQuantity: string) => {
    const qty = Number(packQuantity);
    setForm((f) => {
      const suggested = suggestSkuCode(f.name, Number(f.packQuantity), f.packUnit);
      const next: FormState = {
        ...f,
        packQuantity,
        skuCode:
          f.skuCode.trim() === '' || f.skuCode === suggested
            ? suggestSkuCode(f.name, qty, f.packUnit)
            : f.skuCode,
      };
      const outerQty = Number(next.outerPackQty);
      const packs =
        next.outerPackQty.trim() !== ''
          ? packsPerOuterFromCount(outerQty)
          : null;
      const packsPerOuter =
        packs && !('error' in packs) ? packs.packsPerBox : null;
      return resetMoqUnitIfNeeded(next, packsPerOuter);
    });
  };

  const applyPackUnitChange = (packUnit: PackUnitKey) => {
    setForm((f) => {
      const suggested = suggestSkuCode(
        f.name,
        Number(f.packQuantity),
        f.packUnit,
      );
      const next: FormState = {
        ...f,
        packUnit,
        priceBasis: defaultPriceBasisForPackUnit(packUnit),
        skuCode:
          f.skuCode.trim() === '' || f.skuCode === suggested
            ? suggestSkuCode(f.name, Number(f.packQuantity), packUnit)
            : f.skuCode,
      };
      const outerQty = Number(next.outerPackQty);
      const packs =
        next.outerPackQty.trim() !== ''
          ? packsPerOuterFromCount(outerQty)
          : null;
      const packsPerOuter =
        packs && !('error' in packs) ? packs.packsPerBox : null;
      return resetMoqUnitIfNeeded(next, packsPerOuter);
    });
  };

  const applyOuterChange = (
    patch: Partial<Pick<FormState, 'outerPackQty' | 'outerType'>>,
  ) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      const outerQty = Number(next.outerPackQty);
      const packs =
        next.outerPackQty.trim() !== ''
          ? packsPerOuterFromCount(outerQty)
          : null;
      const packsPerOuter =
        packs && !('error' in packs) ? packs.packsPerBox : null;
      return resetMoqUnitIfNeeded(next, packsPerOuter);
    });
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        mode === 'edit' ? (
          <>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            {step > 1 ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setError(null);
                  setStep((s) => s - 1);
                }}
                disabled={pending}
              >
                Back
              </Button>
            ) : null}
            {step < maxStep ? (
              <Button variant="primary" onClick={goNext} disabled={pending}>
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => void onSubmitEdit()}
                disabled={pending}
              >
                {pending ? 'Saving…' : 'Save Changes'}
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            {step > 1 ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setError(null);
                  setStep((s) => s - 1);
                }}
                disabled={pending}
              >
                Back
              </Button>
            ) : null}
            {step < 5 ? (
              <Button variant="primary" onClick={goNext} disabled={pending}>
                Continue
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => void onSubmitCreate(false)}
                  disabled={pending}
                >
                  {pending ? 'Saving…' : 'Save as Draft'}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void onSubmitCreate(true)}
                  disabled={pending}
                >
                  {pending ? 'Saving…' : 'Create & Publish'}
                </Button>
              </>
            )}
          </>
        )
      }
    >
      <div className="ga-product-form">
        {mode === 'create' ? (
          <ol className="ga-product-form__steps" aria-label="Create steps">
            {CREATE_STEPS.map((label, index) => {
              const n = index + 1;
              const className =
                step === n ? 'is-active' : step > n ? 'is-done' : '';
              return (
                <li key={label} className={className}>
                  {label}
                </li>
              );
            })}
          </ol>
        ) : (
          <ol className="ga-product-form__steps" aria-label="Edit steps">
            {EDIT_STEPS.map((label, index) => {
              const n = index + 1;
              const className =
                step === n ? 'is-active' : step > n ? 'is-done' : '';
              return (
                <li key={label} className={className}>
                  {label}
                </li>
              );
            })}
          </ol>
        )}

        {step === 1 && (
          <div className="ga-product-form__section">
            <TextField
              label="Product Name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. Badam"
              required
            />
            <SelectField
              label="Category"
              value={form.categoryInputMode}
              onChange={(categoryInputMode) =>
                setForm((f) => ({
                  ...f,
                  categoryInputMode: categoryInputMode as FormState['categoryInputMode'],
                }))
              }
            >
              <option value="existing">Use existing category</option>
              <option value="new">Create new category</option>
            </SelectField>
            {form.categoryInputMode === 'existing' ? (
              <SelectField
                label="Select category"
                value={form.categoryId}
                onChange={(categoryId) => setForm((f) => ({ ...f, categoryId }))}
              >
                <option value="">Select category</option>
                {selectableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
            ) : (
              <TextField
                label="New category name"
                value={form.newCategoryName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, newCategoryName: e.target.value }))
                }
                placeholder="e.g. Atta"
              />
            )}
            <div className="ga-product-form__textarea">
              <span className="ga-product-form__label">Description</span>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Optional"
              />
            </div>
            {mode === 'create' ? (
              <div className="ga-product-form__pending-images">
                <span className="ga-product-form__label">
                  Product images (up to 4)
                </span>
                <p className="ga-product-form__hint">
                  Images upload when you save. First image becomes the cover.
                </p>
                <div className="ga-product-form__pending-grid">
                  {pendingImages.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="ga-product-form__pending-thumb">
                      <img src={URL.createObjectURL(file)} alt="" />
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() =>
                          setPendingImages((files) =>
                            files.filter((_, i) => i !== index),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                {pendingImages.length < 4 ? (
                  <label className="ga-product-form__upload-label">
                    + Add image
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPendingImages((files) =>
                            files.length < 4 ? [...files, file] : files,
                          );
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                ) : null}
              </div>
            ) : (
              <>
                <SelectField
                  label="Product type"
                  value={form.productType}
                  onChange={(productType) =>
                    setForm((f) => ({
                      ...f,
                      productType: productType as ProductTypeVm,
                    }))
                  }
                >
                  <option value="PACKED">Packed</option>
                  <option value="BULK">Bulk</option>
                </SelectField>
                <SelectField
                  label="Status"
                  value={form.isActive ? 'published' : 'draft'}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, isActive: v === 'published' }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </SelectField>
                {product ? (
                  <div className="ga-product-form__images-edit">
                    <h3 className="ga-product-form__section-title">Images</h3>
                    <ProductImagesTab
                      productId={product.id}
                      images={product.images}
                      canManage
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}

        {((mode === 'create' && step === 2) || (mode === 'edit' && step === 2)) ? (
          <>
            <p className="ga-product-form__hint">
              Product: <strong>{form.name.trim() || '—'}</strong>
            </p>

            <div className="ga-product-form__section">
              <h3 className="ga-product-form__section-title">Selling pack</h3>
              <div className="ga-product-form__row">
                <TextField
                  label="Pack Size"
                  type="number"
                  min={0}
                  step="any"
                  value={form.packQuantity}
                  onChange={(e) => applyPackQuantityChange(e.target.value)}
                  required
                />
                <SelectField
                  label="Pack Unit"
                  value={form.packUnit}
                  onChange={(packUnit) =>
                    applyPackUnitChange(packUnit as PackUnitKey)
                  }
                >
                  {unitGroups.map((group) => (
                    <optgroup key={group.category} label={group.label}>
                      {group.units.map((u) => (
                        <option key={u.key} value={u.key}>
                          {u.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </SelectField>
              </div>
              <p className="ga-product-form__live">
                Selling pack:{' '}
                <strong>
                  {Number.isFinite(packQty) && packQty > 0
                    ? formatPackLabel(packQty, form.packUnit)
                    : '—'}
                </strong>
                {' · '}
                SKU name: <strong>{skuName || '—'}</strong>
              </p>
              <TextField
                label="SKU Code"
                value={form.skuCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, skuCode: e.target.value }))
                }
                placeholder="e.g. BADAM-250G"
                required
              />
            </div>

            <div className="ga-product-form__section">
              <h3 className="ga-product-form__section-title">
                Outer packaging (optional)
              </h3>
              <p className="ga-product-form__hint">
                How many selling packs fit in one outer package (box / carton /
                case).
              </p>
              <div className="ga-product-form__row">
                <TextField
                  label="Quantity per outer package"
                  type="number"
                  min={0}
                  step={1}
                  value={form.outerPackQty}
                  onChange={(e) =>
                    applyOuterChange({ outerPackQty: e.target.value })
                  }
                  placeholder="e.g. 8"
                />
                <SelectField
                  label="Outer package type"
                  value={form.outerType}
                  onChange={(outerType) =>
                    applyOuterChange({
                      outerType: outerType as OuterPackageKey,
                    })
                  }
                >
                  {OUTER_PACKAGE_OPTIONS.map((key) => (
                    <option key={key} value={key}>
                      {OUTER_PACKAGES[key].label}
                    </option>
                  ))}
                </SelectField>
              </div>
              {livePack.outerSummary ? (
                <p className="ga-product-form__calc">
                  <strong>{livePack.outerSummary.packsLine}</strong>
                  {livePack.outerSummary.contentsLine
                    ? ` · ${livePack.outerSummary.contentsLine}`
                    : ''}
                </p>
              ) : null}
              {livePack.boxError ? (
                <p className="ga-product-form__error">{livePack.boxError}</p>
              ) : null}
            </div>

            <div className="ga-product-form__section">
              <h3 className="ga-product-form__section-title">Minimum order</h3>
              <div className="ga-product-form__row">
                <TextField
                  label="MOQ"
                  type="number"
                  min={0}
                  step={1}
                  value={form.moq}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, moq: e.target.value }))
                  }
                />
                <SelectField
                  label="MOQ unit"
                  value={form.moqUnit}
                  onChange={(moqUnit) =>
                    setForm((f) => ({
                      ...f,
                      moqUnit: moqUnit as MoqUnitValue,
                    }))
                  }
                >
                  {moqOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </SelectField>
              </div>
              {moqConverted && !('error' in moqConverted) ? (
                <p className="ga-product-form__hint">
                  {minimumOrderSummary({
                    moq: moqConverted.packs,
                    packQuantity: packQty,
                    packUnit: form.packUnit,
                    packsPerOuter: livePack.packsPerOuter,
                    outerType: form.outerType,
                    displayUnit: form.moqUnit,
                    displayQuantity: Number(form.moq),
                  })}
                </p>
              ) : null}
              {moqConverted && 'error' in moqConverted ? (
                <p className="ga-product-form__error">{moqConverted.error}</p>
              ) : null}
            </div>
          </>
        ) : null}

        {((mode === 'create' && step === 3) || (mode === 'edit' && step === 3)) ? (
          <div className="ga-product-form__section">
            <p className="ga-product-form__hint">
              Product: <strong>{form.name.trim() || '—'}</strong>
              {' · '}
              Selling pack:{' '}
              <strong>{packLabelFromForm(packQty, form.packUnit)}</strong>
            </p>
            <div className="ga-product-form__row">
              <SelectField
                label="Price Basis"
                value={form.priceBasis}
                onChange={(priceBasis) =>
                  setForm((f) => ({
                    ...f,
                    priceBasis: priceBasis as PriceBasis,
                  }))
                }
              >
                {basisOptions.map((basis) => (
                  <option key={basis} value={basis}>
                    {priceBasisLabel(basis)}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Regular pack price (₹)"
                type="number"
                min={0}
                step="any"
                value={form.basisPrice}
                onChange={(e) =>
                  setForm((f) => ({ ...f, basisPrice: e.target.value }))
                }
                placeholder="e.g. 800"
                required
              />
            </div>
            {livePack.packError ? (
              <p className="ga-product-form__error">{livePack.packError}</p>
            ) : null}
            {livePack.packTradePrice != null ? (
              <ProductPricingDiscountSection
                packLabel={packLabelFromForm(packQty, form.packUnit)}
                regularPackPrice={livePack.packTradePrice}
                packsPerOuter={livePack.packsPerOuter}
                outerType={form.outerType}
                value={{
                  containerPriceMode: form.containerPriceMode,
                  containerCustomPrice: form.containerCustomPrice,
                  outerDiscountTiers: form.outerDiscountTiers,
                }}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              />
            ) : null}
          </div>
        ) : null}

        {mode === 'create' && step === 4 ? (
          <div className="ga-product-form__section">
            <h3 className="ga-product-form__section-title">
              Initial inventory (optional)
            </h3>
            <p className="ga-product-form__hint">
              Leave blank to skip and add stock later from Inventory.
            </p>
            <SelectField
              label="Warehouse"
              value={form.warehouseId}
              onChange={(warehouseId) =>
                setForm((f) => ({ ...f, warehouseId }))
              }
            >
              <option value="">Select warehouse</option>
              {activeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </SelectField>
            {livePack.packsPerOuter != null ? (
              <div className="ga-product-form__row">
                <TextField
                  label={`Closed packages (${OUTER_PACKAGES[form.outerType].plural})`}
                  type="number"
                  min={0}
                  step={1}
                  value={form.initialOuterQty}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      initialOuterQty: e.target.value,
                    }))
                  }
                  placeholder="e.g. 5"
                />
                <TextField
                  label={`Loose packs (${packWord})`}
                  type="number"
                  min={0}
                  step={1}
                  value={form.initialLooseQty}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      initialLooseQty: e.target.value,
                    }))
                  }
                  placeholder="e.g. 2"
                />
              </div>
            ) : (
              <TextField
                label={`Loose packs (${packWord})`}
                type="number"
                min={0}
                step={1}
                value={form.initialLooseQty}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    initialLooseQty: e.target.value,
                  }))
                }
                placeholder="e.g. 100"
              />
            )}
            {hasInventoryInput &&
            inventoryConverted &&
            !('error' in inventoryConverted) ? (
              <p className="ga-product-form__calc">
                <strong>
                  {mixedInventorySummary({
                    totalPacks: inventoryConverted.onHandPacks,
                    packsPerOuter: livePack.packsPerOuter,
                    outerType: form.outerType,
                    packQuantity: packQty,
                    packUnit: form.packUnit,
                  })}
                </strong>
                {' · '}
                will create on-hand stock at the selected warehouse
              </p>
            ) : null}
            {hasInventoryInput &&
            inventoryConverted &&
            'error' in inventoryConverted ? (
              <p className="ga-product-form__error">
                {inventoryConverted.error}
              </p>
            ) : null}
            {!hasInventoryInput ? (
              <p className="ga-product-form__hint">
                Example: stock counted as {packWord} of{' '}
                {formatPackLabel(packQty > 0 ? packQty : 250, form.packUnit)}.
              </p>
            ) : null}
          </div>
        ) : null}

        {((mode === 'create' && step === 5) || (mode === 'edit' && step === 4)) ? (
          <div className="ga-product-form__section">
            <h3 className="ga-product-form__section-title">
              {mode === 'edit' ? 'Review changes' : 'Review checklist'}
            </h3>
            <p className="ga-product-form__live">
              <strong>Product</strong> — {form.name.trim() || '—'} ·{' '}
              {categoryName}
              {form.description.trim()
                ? ` · ${form.description.trim().slice(0, 80)}${form.description.trim().length > 80 ? '…' : ''}`
                : ''}
              {mode === 'edit'
                ? ` · ${form.isActive ? 'Published' : 'Draft'}`
                : ''}
            </p>
            <p className="ga-product-form__live">
              <strong>Selling pack</strong> —{' '}
              {formatPackLabel(packQty, form.packUnit)} · SKU{' '}
              {form.skuCode.trim() || '—'}
              {livePack.packsPerOuter != null
                ? ` · ${livePack.outerSummary?.packsLine ?? `${livePack.packsPerOuter} packs / ${OUTER_PACKAGES[form.outerType].label.toLowerCase()}`}`
                : ' · no outer packaging'}
              {moqConverted && !('error' in moqConverted)
                ? ` · MOQ ${minimumOrderSummary({
                    moq: moqConverted.packs,
                    packQuantity: packQty,
                    packUnit: form.packUnit,
                    packsPerOuter: livePack.packsPerOuter,
                    outerType: form.outerType,
                    displayUnit: form.moqUnit,
                    displayQuantity: Number(form.moq),
                  }).replace(/^Minimum order: /i, '')}`
                : ''}
            </p>
            <p className="ga-product-form__live">
              <strong>Price</strong> — {priceBasisLabel(form.priceBasis)} ₹
              {form.basisPrice || '—'}
              {livePack.packTradePrice != null
                ? ` → customer pack ₹${livePack.packTradePrice.toFixed(2)} / ${packWordOne}`
                : ''}
            </p>
            {mode === 'create' ? (
              <p className="ga-product-form__live">
                <strong>Inventory</strong> —{' '}
                {hasInventoryInput &&
                inventoryConverted &&
                !('error' in inventoryConverted)
                  ? `${warehouseName} · ${mixedInventorySummary({
                      totalPacks: inventoryConverted.onHandPacks,
                      packsPerOuter: livePack.packsPerOuter,
                      outerType: form.outerType,
                      packQuantity: packQty,
                      packUnit: form.packUnit,
                    })}`
                  : 'Skipped (add later)'}
              </p>
            ) : null}
            {mode === 'create' ? (
              <p className="ga-product-form__hint">
                Save as Draft keeps this product hidden from salesmen. Create
                &amp; Publish makes it orderable once price is set.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="ga-product-form__error">{error}</p> : null}
        {success ? (
          <p className="ga-product-form__success">{success}</p>
        ) : null}
      </div>
    </Modal>
  );
}
