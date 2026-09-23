import { useMemo } from 'react';

import {

  buildPackContainerPricing,

  formatInr,

  validateOuterDiscountTiers,

  type ContainerPriceMode,

  type OuterDiscountTier,

} from '@groaurum/catalogue-display';

import { OUTER_PACKAGES, formatPackLabel, type OuterPackageKey } from '@/data/pack-units';

import { TextField } from '@groaurum/ui';

import './ProductPricingDiscountSection.css';



export type OuterDiscountTierFormRow = {

  minOuterQuantity: string;

  discountPerOuterUnit: string;

};



export type PricingDiscountFormSlice = {

  containerPriceMode: ContainerPriceMode;

  containerCustomPrice: string;

  outerDiscountTiers: OuterDiscountTierFormRow[];

};



type Props = {

  packLabel: string;

  regularPackPrice: number | null;

  packsPerOuter?: number | null;

  outerType?: OuterPackageKey;

  value: PricingDiscountFormSlice;

  onChange: (patch: Partial<PricingDiscountFormSlice>) => void;

};



function emptyTier(): OuterDiscountTierFormRow {

  return { minOuterQuantity: '', discountPerOuterUnit: '' };

}



export function ProductPricingDiscountSection({

  packLabel,

  regularPackPrice,

  packsPerOuter,

  outerType = 'box',

  value,

  onChange,

}: Props) {

  const outerMeta = OUTER_PACKAGES[outerType] ?? OUTER_PACKAGES.box;

  const outerLabel = outerMeta.label;

  const outerPlural = outerMeta.plural;

  const hasOuter = packsPerOuter != null && packsPerOuter > 0 && regularPackPrice != null;



  const containerRegularPrice = useMemo(() => {

    if (!hasOuter || regularPackPrice == null) return null;

    const customPrice =

      value.containerPriceMode === 'custom' &&

      value.containerCustomPrice.trim() !== ''

        ? Number(value.containerCustomPrice)

        : null;

    const result = buildPackContainerPricing({

      regularPackPrice,

      packsPerOuter,

      config: {

        packDiscountType: 'none',

        packDiscountValue: 0,

        containerPriceMode: value.containerPriceMode,

        containerCustomPrice: customPrice,

        containerDiscountType: 'none',

        containerDiscountValue: 0,

      },

    });

    if ('error' in result) return null;

    return result.containerRegularPrice ?? null;

  }, [hasOuter, regularPackPrice, packsPerOuter, value.containerPriceMode, value.containerCustomPrice]);



  const tierValidation = useMemo(() => {

    const tiers: OuterDiscountTier[] = value.outerDiscountTiers

      .filter((t) => t.minOuterQuantity.trim() !== '')

      .map((t) => ({

        minOuterQuantity: Number(t.minOuterQuantity) || 0,

        discountPerOuterUnit: Number(t.discountPerOuterUnit) || 0,

      }));

    return validateOuterDiscountTiers(tiers);

  }, [value.outerDiscountTiers]);



  const updateTier = (

    index: number,

    patch: Partial<OuterDiscountTierFormRow>,

  ) => {

    const next = value.outerDiscountTiers.map((row, i) =>

      i === index ? { ...row, ...patch } : row,

    );

    onChange({ outerDiscountTiers: next });

  };



  return (

    <div className="ga-pricing-discount">

      {hasOuter ? (

        <section className="ga-pricing-discount__card">

          <h4 className="ga-pricing-discount__card-title">

            📦 {outerLabel.charAt(0).toUpperCase() + outerLabel.slice(1)} price

          </h4>

          <p className="ga-pricing-discount__subtitle">

            1 {outerLabel} = {packsPerOuter} {packLabel}

          </p>



          <fieldset className="ga-pricing-discount__fieldset">

            <legend>{outerLabel} price method</legend>

            <label className="ga-pricing-discount__radio">

              <input

                type="radio"

                checked={value.containerPriceMode === 'calculated'}

                onChange={() => onChange({ containerPriceMode: 'calculated' })}

              />

              Calculate from pack price

              {regularPackPrice != null ? (

                <span className="ga-pricing-discount__radio-hint">

                  {packsPerOuter} × {formatInr(regularPackPrice)} ={' '}

                  {formatInr(regularPackPrice * packsPerOuter!)}

                </span>

              ) : null}

            </label>

            <label className="ga-pricing-discount__radio">

              <input

                type="radio"

                checked={value.containerPriceMode === 'custom'}

                onChange={() => onChange({ containerPriceMode: 'custom' })}

              />

              Set custom price per {outerLabel}

            </label>

          </fieldset>



          {value.containerPriceMode === 'custom' ? (

            <TextField

              label={`Price per ${outerLabel} (₹)`}

              type="number"

              min={0}

              step="any"

              value={value.containerCustomPrice}

              onChange={(e) =>

                onChange({ containerCustomPrice: e.target.value })

              }

            />

          ) : null}



          {containerRegularPrice != null ? (

            <p className="ga-pricing-discount__hint">

              Price per {outerLabel}:{' '}

              <strong>{formatInr(containerRegularPrice)}</strong>

            </p>

          ) : null}

        </section>

      ) : null}



      {hasOuter ? (

        <section className="ga-pricing-discount__card ga-pricing-discount__card--tiers">

          <h4 className="ga-pricing-discount__card-title">🏷 Quantity Discounts</h4>

          <p className="ga-pricing-discount__hint">

            Apply discounts when customers buy more {outerPlural}.

          </p>

          <p className="ga-pricing-discount__hint">

            Selling unit: <strong>🛍 {outerLabel}</strong>

            {containerRegularPrice != null ? (

              <>

                {' '}

                · Price per {outerLabel}:{' '}

                <strong>{formatInr(containerRegularPrice)}</strong>

              </>

            ) : null}

          </p>



          <div className="ga-pricing-discount__tier-head">

            <span>Buy at least</span>

            <span>Discount per {outerLabel}</span>

            <span />

          </div>



          {value.outerDiscountTiers.map((tier, index) => (

            <div key={index} className="ga-pricing-discount__tier-row">

              <TextField

                label={`Min ${outerPlural}`}

                type="number"

                min={1}

                step={1}

                value={tier.minOuterQuantity}

                onChange={(e) =>

                  updateTier(index, { minOuterQuantity: e.target.value })

                }

                placeholder="5"

              />

              <TextField

                label={`₹ off per ${outerLabel}`}

                type="number"

                min={0}

                step="any"

                value={tier.discountPerOuterUnit}

                onChange={(e) =>

                  updateTier(index, { discountPerOuterUnit: e.target.value })

                }

                placeholder="5"

              />

              <button

                type="button"

                className="ga-pricing-discount__tier-remove"

                onClick={() =>

                  onChange({

                    outerDiscountTiers: value.outerDiscountTiers.filter(

                      (_, i) => i !== index,

                    ),

                  })

                }

                aria-label="Remove tier"

              >

                ×

              </button>

            </div>

          ))}



          <button

            type="button"

            className="ga-pricing-discount__add-tier"

            onClick={() =>

              onChange({

                outerDiscountTiers: [...value.outerDiscountTiers, emptyTier()],

              })

            }

          >

            + Add Discount Tier

          </button>



          {tierValidation ? (

            <p className="ga-pricing-discount__warn">{tierValidation}</p>

          ) : null}

        </section>

      ) : (

        <p className="ga-pricing-discount__hint">

          Configure outer packaging (e.g. Bag, Box) on the Selling Pack step to

          enable quantity discounts on full {outerPlural}.

        </p>

      )}

    </div>

  );

}



export function packLabelFromForm(

  packQuantity: number,

  packUnit: string,

): string {

  if (!Number.isFinite(packQuantity) || packQuantity <= 0) return '—';
  return formatPackLabel(packQuantity, packUnit);

}



export function outerDiscountTiersFromForm(

  tiers: OuterDiscountTierFormRow[],

): OuterDiscountTier[] {

  return tiers

    .filter((t) => t.minOuterQuantity.trim() !== '')

    .map((t) => ({

      minOuterQuantity: Math.max(1, Math.floor(Number(t.minOuterQuantity) || 0)),

      discountPerOuterUnit: Math.max(0, Number(t.discountPerOuterUnit) || 0),

    }))

    .filter((t) => t.minOuterQuantity > 0)

    .sort((a, b) => a.minOuterQuantity - b.minOuterQuantity);

}


