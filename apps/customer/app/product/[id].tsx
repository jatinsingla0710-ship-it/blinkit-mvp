import { useLayoutEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { cartQuantitySummary, formatInr } from '@groaurum/catalogue-display';
import { useLocationStore } from '@/store/location';
import { useCartStore } from '@/store/cart';
import { useCartTotals } from '@/store/hooks';
import { useProductPricing } from '@/hooks/useProductPricing';
import { QtyButton } from '@/components/QtyButton';
import { CartBar } from '@/components/CartBar';
import { LoadingBlock } from '@/components/LoadingBlock';
import { EmptyState } from '@/components/EmptyState';
import { theme } from '@/constants/theme';
import {
  fetchCustomerProductById,
  fetchCustomerProducts,
} from '@/services/customer-catalogue';
import { useCatalogueScope } from '@/hooks/useCatalogueScope';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { scopeId, ready, shopName } = useCatalogueScope();
  const store = useLocationStore((s) => s.store);
  const addItem = useCartStore((s) => s.addItem);
  const setQty = useCartStore((s) => s.setQty);
  const getQty = useCartStore((s) => s.getQty);
  const cartLines = useCartStore((s) => s.lines);

  const productQuery = useQuery({
    queryKey: ['customer', 'product', scopeId, id],
    queryFn: () => fetchCustomerProductById(scopeId!, id!),
    enabled: ready && !!scopeId && !!id,
  });

  const allQuery = useQuery({
    queryKey: ['customer', 'products', scopeId],
    queryFn: () => fetchCustomerProducts(scopeId!),
    enabled: ready && !!scopeId,
  });

  const product = productQuery.data;
  const qty = product ? getQty(product.id) : 0;
  const pricing = useProductPricing(product, qty || product?.moq || 1);
  const galleryUrls = product?.imageUrls?.length
    ? product.imageUrls
    : product?.imageUrl
      ? [product.imageUrl]
      : [];
  const [galleryIndex, setGalleryIndex] = useState(0);
  const heroUrl = galleryUrls[galleryIndex] ?? galleryUrls[0];

  useLayoutEffect(() => {
    navigation.setOptions({ title: product?.name ?? 'Product' });
  }, [navigation, product?.name]);

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of allQuery.data ?? []) map[p.id] = p.price;
    return map;
  }, [allQuery.data]);

  const totals = useCartTotals(priceMap, allQuery.data ?? []);
  const similar = useMemo(() => {
    if (!product || !allQuery.data) return [];
    return allQuery.data
      .filter(
        (p) =>
          p.categoryId === product.categoryId &&
          p.id !== product.id &&
          p.stock > 0,
      )
      .slice(0, 4);
  }, [product, allQuery.data]);

  if (!ready || !scopeId) return null;
  if (productQuery.isLoading) return <LoadingBlock />;
  if (!product) {
    return <EmptyState title="Product not found" emoji="❓" />;
  }

  const oos = product.stock <= 0;
  const packLabel = product.unit;
  const bagQty = product.packsPerCarton ?? 0;
  const outerLabel = (product.outerType ?? 'bag').replace(/^\w/, (c) =>
    c.toUpperCase(),
  );
  const moqIsContainer =
    bagQty > 0 && product.moq >= bagQty && product.moq % bagQty === 0;
  const containerMoq = moqIsContainer ? product.moq / bagQty : 0;
  const qtySummary =
    qty > 0
      ? cartQuantitySummary({
          quantity: qty,
          packsPerOuter: product.packsPerCarton,
          outerType: product.outerType,
          netQuantityUnit: product.netQuantityUnit,
        })
      : null;

  const quickOptions = [
    { label: '1 Piece', value: product.moq || 1 },
    ...(bagQty >= 5 ? [{ label: '5 Pieces', value: 5 }] : []),
    ...(bagQty > 0 ? [{ label: '1 Bag', value: bagQty }] : []),
  ];

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {heroUrl ? (
            <Image
              source={{ uri: heroUrl }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.emoji}>{product.imageEmoji}</Text>
          )}
        </View>
        {galleryUrls.length > 1 ? (
          <View style={styles.thumbRow}>
            {galleryUrls.map((url, index) => (
              <Pressable
                key={url}
                onPress={() => setGalleryIndex(index)}
                style={[
                  styles.thumb,
                  index === galleryIndex && styles.thumbActive,
                ]}
              >
                <Image source={{ uri: url }} style={styles.thumbImage} />
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.unit}>{packLabel}</Text>

        <Text style={styles.sectionTitle}>Choose how you want to buy</Text>

        {!moqIsContainer ? (
          <View style={styles.buyOption}>
            <Text style={styles.buyOptionTitle}>🛍️ Pack</Text>
            <Text style={styles.buyOptionMeta}>{packLabel}</Text>
            <Text style={styles.buyOptionPrice}>
              {formatInr(product.price)} per Pack
            </Text>
            <Text style={styles.buyOptionMoq}>
              Minimum order: {product.moq} Pack{product.moq > 1 ? 's' : ''}
            </Text>
            <Pressable
              style={styles.buyBtn}
              onPress={() =>
                addItem(product, product.quantityStep || product.moq || 1)
              }
              disabled={oos}
            >
              <Text style={styles.buyBtnText}>Add Pack</Text>
            </Pressable>
          </View>
        ) : null}

        {bagQty > 0 ? (
          <View style={styles.buyOption}>
            <Text style={styles.buyOptionTitle}>📦 Full {outerLabel}</Text>
            <Text style={styles.buyOptionMeta}>
              {bagQty} × {packLabel}
            </Text>
            <Text style={styles.buyOptionPrice}>
              {pricing.formattedUnitPrice} per {outerLabel}
            </Text>
            <Text style={styles.buyOptionMoq}>
              Minimum order:{' '}
              {moqIsContainer
                ? `${containerMoq} ${outerLabel}`
                : `1 ${outerLabel}`}
            </Text>
            <Pressable
              style={styles.buyBtn}
              onPress={() => setQty(product.id, bagQty)}
              disabled={oos}
            >
              <Text style={styles.buyBtnText}>Add {outerLabel}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Price</Text>
            <Text style={styles.price}>{pricing.formattedUnitPrice}</Text>
            <Text style={styles.perUnit}>per Piece</Text>
          </View>
        </View>

        {bagQty > 0 && !moqIsContainer ? (
          <View style={styles.bagOffer}>
            <Text style={styles.bagOfferTitle}>Full {outerLabel}</Text>
            <Text style={styles.bagOfferMeta}>
              {bagQty} Packs · {pricing.formattedUnitPrice}
            </Text>
          </View>
        ) : null}

        {(pricing.tierOffers?.length ?? 0) > 0 ? (
          <View style={styles.offers}>
            <Text style={styles.offersTitle}>Quantity offers</Text>
            {pricing.tierOffers!.map((offer) => (
              <Text key={offer} style={styles.offerLine}>
                🏷 {offer}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.stock}>
          {oos
            ? 'Out of stock'
            : product.stockStatus === 'LOW_STOCK'
              ? 'Low stock'
              : `In stock${shopName ? ` · ${shopName}` : store?.area ? ` · ${store.area}` : ''}`}
        </Text>

        {product.description ? (
          <Text style={styles.desc}>{product.description}</Text>
        ) : null}

        <View style={styles.quickRow}>
          {quickOptions.map((opt) => (
            <Pressable
              key={opt.label}
              style={styles.quickChip}
              onPress={() => setQty(product.id, opt.value)}
            >
              <Text style={styles.quickChipText}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          {oos ? (
            <Text style={styles.oos}>Unavailable — check similar SKUs below</Text>
          ) : (
            <>
              <QtyButton
                qty={qty}
                onAdd={() =>
                  addItem(product, product.quantityStep || product.moq || 1)
                }
                onInc={() =>
                  setQty(product.id, qty + (product.quantityStep || 1))
                }
                onDec={() =>
                  setQty(product.id, qty - (product.quantityStep || 1))
                }
                disabled={qty >= product.stock}
              />
              {qty > 0 ? (
                <View style={styles.qtySummary}>
                  {qtySummary ? (
                    <Text style={styles.qtySummaryMain}>
                      Quantity: {qtySummary}
                    </Text>
                  ) : (
                    <Text style={styles.qtySummaryMain}>
                      {qty} Pieces
                    </Text>
                  )}
                  <Text style={styles.qtySummarySub}>
                    Price: {pricing.formattedLineTotal}
                  </Text>
                  {pricing.quantityDiscountTotal > 0 ? (
                    <>
                      <Text style={styles.qtySummarySub}>
                        Quantity discount: −{pricing.formattedQuantityDiscount}
                      </Text>
                      <Text style={styles.discountApplied}>
                        {pricing.savingsMessage}
                      </Text>
                      <Text style={styles.qtySummaryMain}>
                        Total: {pricing.formattedPayable}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.qtySummaryMain}>
                      Total: {pricing.formattedPayable ?? pricing.formattedLineTotal}
                    </Text>
                  )}
                </View>
              ) : null}
            </>
          )}
        </View>

        {similar.length > 0 && (
          <>
            <Text style={styles.similarTitle}>Similar in stock</Text>
            {similar.map((p) => (
              <View key={p.id} style={styles.similarRow}>
                {p.imageUrl ? (
                  <Image source={{ uri: p.imageUrl }} style={styles.similarThumb} />
                ) : (
                  <Text style={styles.similarEmoji}>{p.imageEmoji}</Text>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.similarName}>{p.name}</Text>
                  <Text style={styles.similarMeta}>
                    {formatInr(p.price)} · {p.unit}
                  </Text>
                </View>
                <QtyButton
                  qty={getQty(p.id)}
                  onAdd={() => addItem(p, p.quantityStep || p.moq || 1)}
                  onInc={() =>
                    setQty(p.id, getQty(p.id) + (p.quantityStep || 1))
                  }
                  onDec={() =>
                    setQty(p.id, getQty(p.id) - (p.quantityStep || 1))
                  }
                  disabled={getQty(p.id) >= p.stock}
                  compact
                />
              </View>
            ))}
          </>
        )}
      </ScrollView>
      <CartBar total={totals.total} etaMinutes={store?.etaMinutes ?? 45} />
      {cartLines.length > 0 ? <View style={{ height: 84 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: 120 },
  hero: {
    height: 220,
    borderRadius: 16,
    backgroundColor: theme.colors.yellowSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
  },
  heroImage: { width: '100%', height: '100%' },
  thumbRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: -8,
    marginBottom: theme.spacing.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: {
    borderColor: theme.colors.primary,
  },
  thumbImage: { width: '100%', height: '100%' },
  emoji: { fontSize: 72 },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  unit: {
    marginTop: 4,
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  buyOption: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  buyOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  buyOptionMeta: {
    marginTop: 4,
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  buyOptionPrice: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  buyOptionMoq: {
    marginTop: 4,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  buyBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  priceRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  strikePrice: {
    textDecorationLine: 'line-through',
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  savingsBadge: {
    marginTop: 6,
    color: '#b45309',
    fontWeight: '600',
    fontSize: 13,
  },
  bulkBadge: {
    marginTop: 4,
    color: '#047857',
    fontWeight: '600',
    fontSize: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  perUnit: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  bagOffer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bagOfferTitle: { fontWeight: '700', color: theme.colors.text },
  bagOfferMeta: { marginTop: 4, color: theme.colors.textSecondary },
  offers: { marginTop: 16 },
  offersTitle: { fontWeight: '800', fontSize: 15, marginBottom: 8 },
  offerLine: { color: theme.colors.textSecondary, marginBottom: 4 },
  stock: {
    marginTop: 8,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  desc: {
    marginTop: theme.spacing.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: theme.spacing.lg,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickChipText: { fontWeight: '600', color: theme.colors.text },
  actions: { marginTop: theme.spacing.xl },
  oos: { color: theme.colors.danger, fontWeight: '700' },
  qtySummary: { marginTop: 12 },
  qtySummaryMain: { fontWeight: '700', fontSize: 16 },
  qtySummarySub: { marginTop: 4, color: theme.colors.textMuted },
  discountApplied: {
    marginTop: 6,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  similarTitle: {
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.md,
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  similarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  similarThumb: { width: 40, height: 40, borderRadius: 8 },
  similarEmoji: { fontSize: 28 },
  similarName: { fontWeight: '700', color: theme.colors.text },
  similarMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
});
