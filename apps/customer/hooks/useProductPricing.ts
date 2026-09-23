import { useMemo } from 'react';

import {

  buildPackContainerPricing,

  formatInr,

  lineTotalWithOuterQuantityDiscount,

} from '@groaurum/catalogue-display';

import type { Product } from '@/types';



const EMPTY = {

  unitPrice: 0,

  lineTotal: 0,

  packFinalPrice: 0,

  containerFinalPrice: null as number | null,

  containerRegularPrice: null as number | null,

  quantityDiscountTotal: 0,

  outerUnitCount: 0,

  breakdown: {

    baseUnitPrice: 0,

    baseUnitLabel: 'Piece',

  },

  savingsMessage: null as string | null,

  tierOffers: [] as string[],

  formattedUnitPrice: formatInr(0),

  formattedLineTotal: formatInr(0),

  formattedQuantityDiscount: formatInr(0),
  formattedPayable: formatInr(0),
};



export function useProductPricing(product: Product | undefined, quantity: number) {

  return useMemo(() => {

    if (!product) return EMPTY;



    const qty = quantity || product.moq || 1;

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



    if ('error' in line) {

      return {

        ...EMPTY,

        formattedUnitPrice: formatInr(product.price),

        formattedLineTotal: formatInr(product.price * qty),
        formattedPayable: formatInr(product.price * qty),
      };

    }



    const outerLabel = (product.outerType ?? 'bag').replace(/^\w/, (c) =>

      c.toUpperCase(),

    );

    const tierOffers = (product.outerDiscountTiers ?? [])

      .slice()

      .sort((a, b) => a.minOuterQuantity - b.minOuterQuantity)

      .map(

        (t) =>

          `Buy ${t.minOuterQuantity}+ ${outerLabel}s → Save ${formatInr(t.discountPerOuterUnit)} per ${outerLabel}`,

      );



    return {

      unitPrice: qty > 0 ? line.lineTotal / qty : product.price,

      lineTotal: line.lineTotal,

      packFinalPrice: product.price,

      containerFinalPrice: containerRegular,

      containerRegularPrice: containerRegular,

      quantityDiscountTotal: line.quantityDiscountTotal,

      outerUnitCount: line.outerUnitCount,

      breakdown: {

        baseUnitPrice: product.price,

        baseUnitLabel: 'Pack',

        packsPerOuter: product.packsPerCarton,

        outerUnitLabel: product.outerType ?? 'Bag',

        outerUnitPrice: containerRegular,

        subtotal: line.subtotal,

      },

      savingsMessage:

        line.quantityDiscountTotal > 0

          ? `You save ${formatInr(line.quantityDiscountTotal)}`

          : null,

      tierOffers,

      formattedUnitPrice: formatInr(containerRegular),

      formattedLineTotal: formatInr(line.subtotal),

      formattedQuantityDiscount: formatInr(line.quantityDiscountTotal),

      formattedPayable: formatInr(line.lineTotal),

    };

  }, [product, quantity]);

}


