import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchCustomerCategories,
  fetchCustomerProducts,
} from '@/services/customer-catalogue';
import {
  browseCatalogueProducts,
  buildCatalogueFilterChips,
  CATALOGUE_SORT_OPTIONS,
  type CatalogueFilterId,
  type CatalogueSortId,
} from '@/services/catalogue-browser';
import { useCatalogueScope } from '@/hooks/useCatalogueScope';
import { useCartStore } from '@/store/cart';
import { useCartTotals } from '@/store/hooks';
import { stepSkuQuantity } from '@/utils/product-b2b';
import { ProductCard } from '@/components/ProductCard';
import { CartBar } from '@/components/CartBar';
import { CatalogueSearchBar } from '@/components/catalogue/CatalogueSearchBar';
import { CatalogueFilterChips } from '@/components/catalogue/CatalogueFilterChips';
import { CatalogueSortBar } from '@/components/catalogue/CatalogueSortBar';
import { EmptyState } from '@/components/EmptyState';
import { LoadingBlock } from '@/components/LoadingBlock';
import { theme } from '@/constants/theme';
import type { Product } from '@/types';

/**
 * GroAurum Catalogue v1 — wholesale product browse (not a consumer grocery grid).
 */
export default function CatalogueScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CatalogueFilterId>('all');
  const [sort, setSort] = useState<CatalogueSortId>('trade_price');

  const { scopeId, ready } = useCatalogueScope();
  const addItem = useCartStore((s) => s.addItem);
  const setQty = useCartStore((s) => s.setQty);
  const getQty = useCartStore((s) => s.getQty);
  const cartLines = useCartStore((s) => s.lines);

  const productsQuery = useQuery({
    queryKey: ['customer', 'products', scopeId],
    queryFn: () => fetchCustomerProducts(scopeId!),
    enabled: ready && !!scopeId,
  });

  const categoriesQuery = useQuery({
    queryKey: ['customer', 'categories'],
    queryFn: fetchCustomerCategories,
    enabled: ready && !!scopeId,
  });

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of productsQuery.data ?? []) map[p.id] = p.price;
    return map;
  }, [productsQuery.data]);

  const totals = useCartTotals(priceMap);

  const browsed = useMemo(() => {
    return browseCatalogueProducts({
      products: productsQuery.data ?? [],
      categories: categoriesQuery.data ?? [],
      query,
      filter,
      sort,
    });
  }, [productsQuery.data, categoriesQuery.data, query, filter, sort]);

  if (!ready || !scopeId) {
    return null;
  }

  if (productsQuery.isLoading || categoriesQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <LoadingBlock label="Loading catalogue…" />
      </SafeAreaView>
    );
  }

  if (productsQuery.isError || categoriesQuery.isError) {
    const message =
      productsQuery.error instanceof Error
        ? productsQuery.error.message
        : categoriesQuery.error instanceof Error
          ? categoriesQuery.error.message
          : 'Could not load catalogue.';
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Categories</Text>
        </View>
        <EmptyState
          emoji="◇"
          title="Catalogue unavailable"
          subtitle={message}
          actionLabel="Retry"
          onAction={() => {
            void productsQuery.refetch();
            void categoriesQuery.refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  const products = productsQuery.data ?? [];
  const isEmptyCatalogue = products.length === 0;
  const isEmptyResults = !isEmptyCatalogue && browsed.length === 0;

  const onAdd = (product: Product) => {
    const qty = stepSkuQuantity(product, 0, 1);
    if (qty > 0) addItem(product, qty);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Categories</Text>
        <Text style={styles.subtitle}>Search products & wholesale SKUs</Text>
        <CatalogueSearchBar value={query} onChangeText={setQuery} />
        <CatalogueFilterChips
          chips={buildCatalogueFilterChips(categoriesQuery.data ?? [])}
          selected={filter}
          onSelect={setFilter}
        />
        {!isEmptyCatalogue ? (
          <CatalogueSortBar
            options={CATALOGUE_SORT_OPTIONS}
            selected={sort}
            onSelect={setSort}
            resultCount={browsed.length}
          />
        ) : null}
      </View>

      {isEmptyCatalogue ? (
        <EmptyState
          emoji="◇"
          title="Catalogue is empty"
          subtitle="No active products or priced SKUs are available yet. This is not a demo catalogue."
        />
      ) : (
        <FlatList
          data={browsed}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              emoji="⌕"
              title={isEmptyResults ? 'No matching SKUs' : 'No products'}
              subtitle={
                query.trim()
                  ? 'Try another search, filter, or sort.'
                  : 'Adjust filters to see wholesale SKUs.'
              }
              actionLabel="Clear filters"
              onAction={() => {
                setQuery('');
                setFilter('all');
                setSort('trade_price');
              }}
            />
          }
          renderItem={({ item }: { item: Product }) => (
            <View style={styles.gridCell}>
              <ProductCard
                product={item}
                qty={getQty(item.id)}
                onAdd={() => onAdd(item)}
                onInc={() =>
                  setQty(item.id, stepSkuQuantity(item, getQty(item.id), 1))
                }
                onDec={() =>
                  setQty(item.id, stepSkuQuantity(item, getQty(item.id), -1))
                }
              />
            </View>
          )}
        />
      )}

      <CartBar total={totals.total} />
      {cartLines.length > 0 ? <View style={{ height: 88 }} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  list: { paddingHorizontal: 8, paddingBottom: 120, flexGrow: 1 },
  gridRow: {
    gap: 0,
  },
  gridCell: {
    flex: 1,
    padding: 4,
  },
});
