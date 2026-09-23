import { useMemo } from 'react';
import { lineTotalWithOuterQuantityDiscount, buildPackContainerPricing } from '@groaurum/catalogue-display';
import { computeOrderTotals } from '@/utils/order-totals';
import type { Product } from '@/types';
import { useCartStore } from '@/store/cart';

function lineTotalForProduct(product: Product, qty: number): number {
  const containerPricing = buildPackContainerPricing({
    regularPackPrice: product.price,
    packsPerOuter: product.packsPerCarton,
    config: {
      packDiscountType: 'none',
      packDiscountValue: 0,
      containerPriceMode: product.containerPriceMode ?? 'calculated',
      containerCustomPrice: product.containerCustomPrice ?? null,
      containerDiscountType: 'none',
      containerDiscountValue: 0,
    },
  });
  const containerRegular =
    !('error' in containerPricing) && containerPricing.containerRegularPrice != null
      ? containerPricing.containerRegularPrice
      : product.price * (product.packsPerCarton ?? 1);

  const line = lineTotalWithOuterQuantityDiscount({
    quantityPacks: qty,
    packRegularPrice: product.price,
    containerRegularPrice: containerRegular,
    packsPerOuter: product.packsPerCarton,
    tiers: product.outerDiscountTiers ?? [],
  });
  if ('error' in line) return product.price * qty;
  return line.lineTotal;
}

/** Stable cart totals with outer-quantity discount-aware pricing. */
export function useCartTotals(
  priceMap: Record<string, number>,
  products: Product[] = [],
) {
  const lines = useCartStore((s) => s.lines);
  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p] as const)),
    [products],
  );

  return useMemo(() => {
    const priced = lines.map((l) => {
      const product = productById.get(l.productId);
      if (product) {
        const total = lineTotalForProduct(product, l.qty);
        return { price: total / l.qty, qty: l.qty };
      }
      return { price: priceMap[l.productId] ?? 0, qty: l.qty };
    });
    return computeOrderTotals(priced);
  }, [lines, priceMap, productById]);
}

export function useCartItemCount() {
  const lines = useCartStore((s) => s.lines);
  return useMemo(() => lines.reduce((sum, l) => sum + l.qty, 0), [lines]);
}
