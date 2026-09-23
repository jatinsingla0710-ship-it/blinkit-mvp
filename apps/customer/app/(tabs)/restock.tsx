import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  countRestockSkus,
  countRestockUnits,
  estimateRestockValue,
  fetchRestockPlan,
} from '@/services/restock';
import { useCatalogueScope } from '@/hooks/useCatalogueScope';
import { useCartStore } from '@/store/cart';
import { LoadingBlock } from '@/components/LoadingBlock';
import { EmptyState } from '@/components/EmptyState';
import { RestockSummaryCard } from '@/components/restock/RestockSummaryCard';
import { EstimatedOrderValueCard } from '@/components/restock/EstimatedOrderValueCard';
import { RestockProductRow } from '@/components/restock/RestockProductRow';
import { RestockReviewBar } from '@/components/restock/RestockReviewBar';
import { stepSkuQuantity } from '@/utils/product-b2b';
import { theme } from '@/constants/theme';

export default function RestockScreen() {
  const router = useRouter();
  const { scopeId, ready, shopName } = useCatalogueScope();
  const addItem = useCartStore((s) => s.addItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const [qtyByProductId, setQtyByProductId] = useState<Record<string, number>>(
    {},
  );
  const [initializedKey, setInitializedKey] = useState<string | null>(null);

  const planQuery = useQuery({
    queryKey: ['customer', 'restock', scopeId],
    queryFn: () => fetchRestockPlan(scopeId!),
    enabled: ready && !!scopeId,
  });

  useEffect(() => {
    const plan = planQuery.data;
    if (!plan || !scopeId) return;
    const key = `${scopeId}:${plan.suggestions.map((s) => s.product.id).join(',')}`;
    if (initializedKey === key) return;

    const next: Record<string, number> = {};
    for (const row of plan.suggestions) {
      next[row.product.id] = row.suggestedQty;
    }
    setQtyByProductId(next);
    setInitializedKey(key);
  }, [planQuery.data, scopeId, initializedKey]);

  const estimatedValue = useMemo(() => {
    if (!planQuery.data) return 0;
    return estimateRestockValue(planQuery.data.suggestions, qtyByProductId);
  }, [planQuery.data, qtyByProductId]);

  const unitCount = useMemo(
    () => countRestockUnits(qtyByProductId),
    [qtyByProductId],
  );
  const selectedSkuCount = useMemo(
    () => countRestockSkus(qtyByProductId),
    [qtyByProductId],
  );

  if (!ready || !scopeId) {
    return null;
  }

  if (planQuery.isLoading) {
    return <LoadingBlock label="Building restock list…" />;
  }

  if (planQuery.isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState
          title="Could not load restock"
          subtitle={
            planQuery.error instanceof Error
              ? planQuery.error.message
              : 'Please try again.'
          }
          actionLabel="Retry"
          onAction={() => void planQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  const plan = planQuery.data!;

  if (!plan.hasHistory || plan.suggestions.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Restock</Text>
          <Text style={styles.subtitle}>
            {shopName ? `For ${shopName}` : 'Reorder from prior deliveries'}
          </Text>
        </View>
        <EmptyState
          emoji="📦"
          title="No order history yet"
          subtitle="Browse the catalogue to place your first order. Restock will suggest SKUs from what you typically buy."
          actionLabel="Browse catalogue"
          onAction={() => router.push('/(tabs)/catalogue')}
        />
      </SafeAreaView>
    );
  }

  const onInc = (productId: string) => {
    const row = plan.suggestions.find((s) => s.product.id === productId);
    if (!row) return;
    setQtyByProductId((prev) => ({
      ...prev,
      [productId]: stepSkuQuantity(
        row.product,
        prev[productId] ?? 0,
        1,
      ),
    }));
  };

  const onDec = (productId: string) => {
    const row = plan.suggestions.find((s) => s.product.id === productId);
    if (!row) return;
    setQtyByProductId((prev) => ({
      ...prev,
      [productId]: stepSkuQuantity(
        row.product,
        prev[productId] ?? 0,
        -1,
      ),
    }));
  };

  const onReviewOrder = () => {
    clearCart();
    for (const row of plan.suggestions) {
      const qty = qtyByProductId[row.product.id] ?? 0;
      if (qty <= 0) continue;
      addItem(row.product, qty);
    }
    router.push('/cart');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Restock</Text>
          <Text style={styles.subtitle}>
            {shopName
              ? `Reorder for ${shopName} in under a minute`
              : 'Reorder inventory in under a minute'}
          </Text>
        </View>

        <RestockSummaryCard
          skuCount={plan.skuCount}
          totalUnits={plan.totalSuggestedUnits}
        />

        <EstimatedOrderValueCard
          estimatedValue={estimatedValue}
          selectedSkuCount={selectedSkuCount}
        />

        <View style={styles.listBlock}>
          <Text style={styles.section}>Suggested products</Text>
          <View style={styles.list}>
            {plan.suggestions.map((suggestion) => (
              <RestockProductRow
                key={suggestion.product.id}
                suggestion={suggestion}
                qty={qtyByProductId[suggestion.product.id] ?? 0}
                onInc={() => onInc(suggestion.product.id)}
                onDec={() => onDec(suggestion.product.id)}
              />
            ))}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.addMore, pressed && { opacity: 0.92 }]}
          onPress={() => router.push('/(tabs)/catalogue')}
        >
          <Text style={styles.addMoreText}>Add more products</Text>
        </Pressable>
      </ScrollView>

      <RestockReviewBar
        total={estimatedValue}
        unitCount={unitCount}
        onPress={onReviewOrder}
      />
      {unitCount > 0 ? <View style={{ height: 88 }} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 16,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  listBlock: {
    gap: 8,
  },
  section: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.2,
  },
  list: {
    gap: 8,
  },
  addMore: {
    minHeight: 48,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
});
