import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchCustomerBestsellers,
  fetchCustomerCategories,
  fetchCustomerProducts,
} from '@/services/customer-catalogue';
import {
  buildTradePriceMovements,
  getHomeLastOrderSummary,
  getHomeServiceSummary,
} from '@/services/home-summary';
import { useCatalogueScope } from '@/hooks/useCatalogueScope';
import { useCartStore } from '@/store/cart';
import { useCartTotals } from '@/store/hooks';
import { ProductCard } from '@/components/ProductCard';
import { CartBar } from '@/components/CartBar';
import { LoadingBlock } from '@/components/LoadingBlock';
import { HomeSearchField } from '@/components/home/HomeSearchField';
import { TradePriceStrip } from '@/components/home/TradePriceStrip';
import { CategoryTiles } from '@/components/home/CategoryTiles';
import { LastOrderCard } from '@/components/home/LastOrderCard';
import { theme } from '@/constants/theme';
import type { Product } from '@/types';
import { isMockAdapterMode } from '@/config/env';
import { useLocationStore } from '@/store/location';

export default function HomeScreen() {
  const router = useRouter();
  const { scopeId, ready, shopName } = useCatalogueScope();
  const address = useLocationStore((s) => s.address);
  const store = useLocationStore((s) => s.store);
  const cartLines = useCartStore((s) => s.lines);
  const addItem = useCartStore((s) => s.addItem);
  const setQty = useCartStore((s) => s.setQty);
  const getQty = useCartStore((s) => s.getQty);

  const categoriesQuery = useQuery({
    queryKey: ['customer', 'categories', scopeId],
    queryFn: fetchCustomerCategories,
    enabled: ready,
  });

  const productsQuery = useQuery({
    queryKey: ['customer', 'products', scopeId],
    queryFn: () => fetchCustomerProducts(scopeId!),
    enabled: ready && !!scopeId,
  });

  const bestsellersQuery = useQuery({
    queryKey: ['customer', 'bestsellers', scopeId],
    queryFn: () => fetchCustomerBestsellers(scopeId!),
    enabled: ready && !!scopeId,
  });

  const lastOrderQuery = useQuery({
    queryKey: ['customer', 'home', 'last-order', scopeId],
    queryFn: () => getHomeLastOrderSummary(scopeId),
    enabled: ready && !!scopeId,
  });

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of productsQuery.data ?? []) map[p.id] = p.price;
    return map;
  }, [productsQuery.data]);

  const totals = useCartTotals(priceMap);
  const tradePrices = useMemo(
    () => buildTradePriceMovements(bestsellersQuery.data ?? productsQuery.data ?? []),
    [bestsellersQuery.data, productsQuery.data],
  );
  const service = getHomeServiceSummary();

  if (!ready || !scopeId) {
    return null;
  }

  const onAdd = (product: Product) => {
    const step = product.quantityStep || product.moq || 1;
    addItem(product, step);
  };

  const onInc = (product: Product) => {
    const current = getQty(product.id);
    const step = product.quantityStep || 1;
    setQty(product.id, current + step);
  };

  const onDec = (product: Product) => {
    const current = getQty(product.id);
    const step = product.quantityStep || 1;
    setQty(product.id, current - step);
  };

  if (productsQuery.isLoading || categoriesQuery.isLoading) {
    return <LoadingBlock />;
  }

  if (productsQuery.isError || categoriesQuery.isError) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Could not load catalogue</Text>
        <Text style={styles.emptyBody}>
          {(productsQuery.error as Error)?.message ??
            (categoriesQuery.error as Error)?.message ??
            'Backend error'}
        </Text>
      </View>
    );
  }

  const products = productsQuery.data ?? [];
  const featured = (bestsellersQuery.data ?? products).slice(0, 8);
  const isEmpty = products.length === 0;

  const locationLine = isMockAdapterMode()
    ? `${address?.label ?? 'Home'} · ${store?.area ?? address?.text ?? ''}`
    : shopName ?? 'Your shop';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.yellowSafe}>
        <View style={styles.header}>
          <Text style={styles.etaLabel}>Delivery in</Text>
          <Text style={styles.eta}>
            {service.nextDeliveryLabel} · {service.timeSlot}
          </Text>
          <Pressable
            onPress={() => {
              if (isMockAdapterMode()) router.push('/location');
              else router.push('/account' as never);
            }}
            style={styles.locationRow}
          >
            <Text style={styles.pin}>📍</Text>
            <Text style={styles.location} numberOfLines={1}>
              {locationLine}
            </Text>
            <Text style={styles.chevron}>▾</Text>
          </Pressable>
          <HomeSearchField onPress={() => router.push('/(tabs)/catalogue')} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {!isEmpty ? (
          <View style={styles.block}>
            <Text style={styles.section}>Shop by category</Text>
            <CategoryTiles
              categories={categoriesQuery.data ?? []}
              onSelect={(id) => router.push(`/category/${id}`)}
            />
          </View>
        ) : null}

        {!isEmpty ? (
          <View style={styles.block}>
            <View style={styles.sectionHeader}>
              <Text style={styles.section}>Today’s trade prices</Text>
            </View>
            <TradePriceStrip items={tradePrices} />
          </View>
        ) : null}

        {isEmpty ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Catalogue is empty</Text>
            <Text style={styles.emptyBody}>
              No active products are available yet.
            </Text>
          </View>
        ) : (
          <View style={styles.block}>
            <Text style={styles.section}>Bestsellers for you</Text>
            <View style={styles.productGrid}>
              {featured.map((item) => (
                <View key={item.id} style={styles.gridCell}>
                  <ProductCard
                    product={item}
                    qty={getQty(item.id)}
                    onAdd={() => onAdd(item)}
                    onInc={() => onInc(item)}
                    onDec={() => onDec(item)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {lastOrderQuery.data ? (
          <View style={styles.block}>
            <Text style={styles.section}>Order again</Text>
            <LastOrderCard
              order={lastOrderQuery.data}
              onPress={() => {
                const order = lastOrderQuery.data;
                if (!order) return;
                if (order.id !== 'demo-last' && order.id !== 'GA-RESTOCK-SEED') {
                  router.push(`/order/${order.id}`);
                } else {
                  router.push('/(tabs)/restock');
                }
              }}
            />
          </View>
        ) : null}
      </ScrollView>

      <CartBar total={totals.total} />
      {cartLines.length > 0 ? <View style={{ height: 88 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  yellowSafe: {
    backgroundColor: theme.colors.yellow,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    gap: 6,
    backgroundColor: theme.colors.yellow,
  },
  etaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    opacity: 0.7,
  },
  eta: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.4,
    marginTop: -2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  pin: {
    fontSize: 12,
  },
  location: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  chevron: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '800',
  },
  scroll: {
    paddingTop: 16,
    paddingBottom: 120,
    gap: 18,
  },
  block: {
    paddingHorizontal: 12,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  section: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.2,
    paddingHorizontal: 4,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  gridCell: {
    width: '50%',
    padding: 4,
  },
  empty: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
});
