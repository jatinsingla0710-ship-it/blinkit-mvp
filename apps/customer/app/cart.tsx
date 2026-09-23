import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchCustomerProducts } from '@/services/customer-catalogue';
import { getHomeServiceSummary } from '@/services/home-summary';
import { useCatalogueScope } from '@/hooks/useCatalogueScope';
import { useCustomerSession } from '@/context/CustomerSessionProvider';
import { useLocationStore } from '@/store/location';
import { useCartStore } from '@/store/cart';
import { useCartItemCount } from '@/store/hooks';
import { EmptyState } from '@/components/EmptyState';
import { LoadingBlock } from '@/components/LoadingBlock';
import { ReviewShopSummary } from '@/components/review-order/ReviewShopSummary';
import { ReviewOrderItemRow } from '@/components/review-order/ReviewOrderItemRow';
import { ReviewOrderSummaryCard } from '@/components/review-order/ReviewOrderSummaryCard';
import {
  ReviewPaymentOptions,
  type ReviewPaymentMethod,
} from '@/components/review-order/ReviewPaymentOptions';
import { ConfirmOrderBar } from '@/components/review-order/ConfirmOrderBar';
import { stepSkuQuantity } from '@/utils/product-b2b';
import { theme } from '@/constants/theme';
import { isMockAdapterMode } from '@/config/env';

/**
 * Review Order v1 — wholesale order confirmation (not a consumer shopping cart).
 */
export default function ReviewOrderScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { scopeId, ready, shopName } = useCatalogueScope();
  const { snapshot } = useCustomerSession();
  const store = useLocationStore((s) => s.store);
  const address = useLocationStore((s) => s.address);
  const lines = useCartStore((s) => s.lines);
  const setQty = useCartStore((s) => s.setQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const addItem = useCartStore((s) => s.addItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const getQty = useCartStore((s) => s.getQty);
  const itemCount = useCartItemCount();

  const [payment, setPayment] = useState<ReviewPaymentMethod>('cod');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);

  const productsQuery = useQuery({
    queryKey: ['customer', 'products', scopeId],
    queryFn: () => fetchCustomerProducts(scopeId!),
    enabled: ready && !!scopeId,
  });

  const productMap = useMemo(() => {
    const map = new Map(
      (productsQuery.data ?? []).map((p) => [p.id, p] as const),
    );
    return map;
  }, [productsQuery.data]);

  const estimatedValue = useMemo(() => {
    return lines.reduce((sum, line) => {
      const product = productMap.get(line.productId);
      if (!product) return sum;
      return sum + product.price * line.qty;
    }, 0);
  }, [lines, productMap]);

  const service = getHomeServiceSummary();
  const deliverySchedule = `${service.nextDeliveryLabel} · ${service.timeSlot}`;

  const resolvedShopName =
    shopName ??
    snapshot.shopContext?.shop.tradeName ??
    store?.name ??
    'Your shop';

  const salesExecutive =
    snapshot.shopContext?.shop.assignedSalesmanProfileId
      ? 'Assigned sales executive'
      : isMockAdapterMode()
        ? 'Priya Sharma'
        : 'Assigned on account activation';

  const deliveryAddressText = isMockAdapterMode()
    ? address
      ? `${address.label} · ${address.text}`
      : 'Set a delivery pin from location'
    : [
        snapshot.shopContext?.shop.deliveryAddressLine,
        snapshot.shopContext?.shop.deliveryCity,
        snapshot.shopContext?.shop.deliveryPinCode,
      ]
        .filter(Boolean)
        .join(', ') || 'Shop delivery address on file';

  if (!ready || !scopeId) return null;
  if (productsQuery.isLoading) return <LoadingBlock />;

  if (!lines.length) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <EmptyState
          title="No items to review"
          subtitle="Build a restock list or add SKUs from the catalogue, then review before confirming."
          actionLabel="Go to Restock"
          onAction={() => router.replace('/(tabs)/restock')}
        />
      </SafeAreaView>
    );
  }

  const onInc = (productId: string) => {
    const product = productMap.get(productId);
    if (!product) return;
    const next = stepSkuQuantity(product, getQty(productId), 1);
    setQty(productId, next);
  };

  const onDec = (productId: string) => {
    const product = productMap.get(productId);
    if (!product) return;
    const next = stepSkuQuantity(product, getQty(productId), -1);
    setQty(productId, next);
  };

  const confirmOrder = async () => {
    setConfirming(true);
    try {
      if (!isMockAdapterMode()) {
        const shop = snapshot.shopContext?.shop;
        if (!shop?.serviceAreaId || !scopeId) {
          Alert.alert('Shop not ready', 'Linked shop / service area is missing.');
          return;
        }

        for (const line of lines) {
          const product = productMap.get(line.productId);
          if (!product) {
            throw new Error('A catalogue SKU in your cart is no longer available.');
          }
          if (line.qty < product.moq) {
            throw new Error(`${product.name}: quantity below MOQ ${product.moq}.`);
          }
          if (line.qty > product.stock) {
            throw new Error(
              `${product.name}: only ${product.stock} available.`,
            );
          }
          if (line.qty % (product.quantityStep || 1) !== 0) {
            throw new Error(
              `${product.name}: quantity must be in steps of ${product.quantityStep}.`,
            );
          }
        }

        const { placeCustomerOrder } = await import('@/services/customer-orders');
        const order = await placeCustomerOrder({
          shopId: scopeId,
          serviceAreaId: shop.serviceAreaId,
          notes: notes.trim() || undefined,
          lines: lines.map((line) => {
            const product = productMap.get(line.productId)!;
            return {
              skuId: line.productId,
              quantity: line.qty,
              agreedUnitPrice: product.price,
            };
          }),
        });
        clearCart();
        await queryClient.invalidateQueries({ queryKey: ['orders'] });
        await queryClient.invalidateQueries({ queryKey: ['customer'] });
        router.replace(`/order/${order.id}`);
        return;
      }

      const { createOrder, findSubstitute, validateCartStock } = await import(
        '@/services/mock'
      );

      if (!store || !address) {
        Alert.alert('Delivery location required', 'Choose a delivery pin to continue.');
        router.push('/location');
        return;
      }

      const issues = await validateCartStock(lines);
      if (issues.length) {
        const first = issues[0];
        const sub = findSubstitute(store.id, first.productId);
        Alert.alert(
          'Stock changed',
          `${first.name}: only ${first.available} left.` +
            (sub ? `\n\nSuggested substitute: ${sub.name}` : ''),
          [
            {
              text: 'Remove item',
              style: 'destructive',
              onPress: () => removeItem(first.productId),
            },
            sub
              ? {
                  text: 'Add substitute',
                  onPress: () => {
                    removeItem(first.productId);
                    addItem(
                      sub,
                      Math.min(
                        first.requested,
                        stepSkuQuantity(sub, 0, 1) || sub.moq,
                      ),
                    );
                  },
                }
              : { text: 'OK' },
          ],
        );
        return;
      }

      const order = await createOrder({
        storeId: store.id,
        lines,
        address,
        paymentMethod: payment === 'cod' ? 'Cash on Delivery' : 'Pay Online',
        notes,
        shopName: resolvedShopName,
        salesExecutive,
        deliverySchedule,
      });
      clearCart();
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['customer'] });
      router.replace(`/order/${order.id}`);
    } catch (error) {
      Alert.alert(
        'Could not confirm order',
        error instanceof Error ? error.message : 'Something went wrong',
      );
    } finally {
      setConfirming(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Review Order</Text>
          <Text style={styles.subtitle}>Confirm today’s wholesale order</Text>
        </View>

        <ReviewShopSummary
          shopName={resolvedShopName}
          deliverySchedule={deliverySchedule}
          salesExecutive={salesExecutive}
        />

        <View style={styles.block}>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>Order items</Text>
            <Pressable onPress={clearCart} hitSlop={8}>
              <Text style={styles.clear}>Clear all</Text>
            </Pressable>
          </View>
          <View style={styles.list}>
            {lines.map((line) => {
              const product = productMap.get(line.productId);
              if (!product) return null;
              return (
                <ReviewOrderItemRow
                  key={line.productId}
                  product={product}
                  qty={line.qty}
                  onInc={() => onInc(line.productId)}
                  onDec={() => onDec(line.productId)}
                />
              );
            })}
          </View>
        </View>

        <ReviewOrderSummaryCard
          totalItems={itemCount}
          estimatedValue={estimatedValue}
        />

        <ReviewPaymentOptions value={payment} onChange={setPayment} />

        <View style={styles.block}>
          <Text style={styles.section}>Delivery address</Text>
          <View style={styles.card}>
            <Text style={styles.addressText}>{deliveryAddressText}</Text>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.section}>Notes (optional)</Text>
          <TextInput
            style={styles.notes}
            value={notes}
            onChangeText={setNotes}
            placeholder="Delivery instructions or SKU preferences"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <ConfirmOrderBar
        estimatedValue={estimatedValue}
        loading={confirming}
        onPress={() => void confirmOrder()}
      />
      <View style={{ height: 96 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  wrap: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
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
  block: {
    gap: 8,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  clear: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.danger,
  },
  list: {
    gap: 8,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    lineHeight: 20,
  },
  notes: {
    minHeight: 88,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.text,
  },
});
