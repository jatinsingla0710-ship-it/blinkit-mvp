import { useLayoutEffect, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  fetchCustomerCategories,
  fetchCustomerProducts,
  fetchCustomerProductsByCategory,
} from '@/services/customer-catalogue';
import { useCatalogueScope } from '@/hooks/useCatalogueScope';
import { useCartStore } from '@/store/cart';
import { useCartTotals } from '@/store/hooks';
import { ProductCard } from '@/components/ProductCard';
import { CartBar } from '@/components/CartBar';
import { EmptyState } from '@/components/EmptyState';
import { LoadingBlock } from '@/components/LoadingBlock';
import { theme } from '@/constants/theme';
import type { Product } from '@/types';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { scopeId, ready } = useCatalogueScope();
  const addItem = useCartStore((s) => s.addItem);
  const setQty = useCartStore((s) => s.setQty);
  const getQty = useCartStore((s) => s.getQty);
  const cartLines = useCartStore((s) => s.lines);

  const categoriesQuery = useQuery({
    queryKey: ['customer', 'categories', scopeId],
    queryFn: fetchCustomerCategories,
    enabled: ready,
  });

  const productsQuery = useQuery({
    queryKey: ['customer', 'category', scopeId, id],
    queryFn: () => fetchCustomerProductsByCategory(scopeId!, id!),
    enabled: ready && !!scopeId && !!id,
  });

  const allQuery = useQuery({
    queryKey: ['customer', 'products', scopeId],
    queryFn: () => fetchCustomerProducts(scopeId!),
    enabled: ready && !!scopeId,
  });

  const category = categoriesQuery.data?.find((c) => c.id === id);

  useLayoutEffect(() => {
    navigation.setOptions({ title: category?.name ?? 'Category' });
  }, [navigation, category?.name]);

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of allQuery.data ?? []) map[p.id] = p.price;
    return map;
  }, [allQuery.data]);

  const totals = useCartTotals(priceMap);

  if (!ready || !scopeId) return null;
  if (productsQuery.isLoading) return <LoadingBlock />;

  return (
    <View style={styles.wrap}>
      <FlatList
        data={productsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState title="No products" subtitle="This category is empty." />
        }
        renderItem={({ item }: { item: Product }) => (
          <View style={styles.gridCell}>
            <ProductCard
              product={item}
              qty={getQty(item.id)}
              onAdd={() => addItem(item, item.quantityStep || item.moq || 1)}
              onInc={() =>
                setQty(item.id, getQty(item.id) + (item.quantityStep || 1))
              }
              onDec={() =>
                setQty(item.id, getQty(item.id) - (item.quantityStep || 1))
              }
            />
          </View>
        )}
      />
      <CartBar total={totals.total} />
      {cartLines.length > 0 ? <View style={{ height: 88 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.background },
  list: { paddingHorizontal: 8, paddingBottom: 120, flexGrow: 1 },
  gridCell: { flex: 1, padding: 4 },
});
