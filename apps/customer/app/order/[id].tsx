import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getOrderById } from '@/services/mock';
import { fetchCustomerOrderById } from '@/services/customer-orders';
import { useCatalogueScope } from '@/hooks/useCatalogueScope';
import { isMockAdapterMode } from '@/config/env';
import { buildOrderTimeline } from '@/services/order-timeline';
import { getHomeServiceSummary } from '@/services/home-summary';
import { OrderTimelineHeader } from '@/components/order-timeline/OrderTimelineHeader';
import { OrderLifecycleTimeline } from '@/components/order-timeline/OrderLifecycleTimeline';
import { OrderShopSummary } from '@/components/order-timeline/OrderShopSummary';
import { OrderItemsCard } from '@/components/order-timeline/OrderItemsCard';
import { OrderPaymentSummary } from '@/components/order-timeline/OrderPaymentSummary';
import { OrderDeliveryInfo } from '@/components/order-timeline/OrderDeliveryInfo';
import { OrderNotesCard } from '@/components/order-timeline/OrderNotesCard';
import { RepeatOrderBar } from '@/components/order-timeline/RepeatOrderBar';
import { LoadingBlock } from '@/components/LoadingBlock';
import { EmptyState } from '@/components/EmptyState';
import { theme } from '@/constants/theme';

/**
 * GroAurum Order Timeline v1 — wholesale order lifecycle (not rider tracking).
 */
export default function OrderTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { scopeId, ready } = useCatalogueScope();

  const orderQuery = useQuery({
    queryKey: ['customer', 'order', id, scopeId],
    queryFn: async () => {
      if (isMockAdapterMode()) {
        return getOrderById(id!);
      }
      if (!scopeId) return null;
      return fetchCustomerOrderById(id!, scopeId);
    },
    enabled: !!id && ready,
    refetchInterval: 2500,
  });

  if (orderQuery.isLoading) return <LoadingBlock />;
  const order = orderQuery.data;
  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        actionLabel="Orders"
        onAction={() => router.replace('/(tabs)/orders')}
      />
    );
  }

  const service = getHomeServiceSummary();
  const deliverySchedule =
    order.deliverySchedule ??
    `${service.nextDeliveryLabel} · ${service.timeSlot}`;
  const shopName = order.shopName ?? order.storeName;
  const salesExecutive = order.salesExecutive ?? 'Assigned sales executive';
  const stages = buildOrderTimeline(order.status, order.statusHistory);

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <OrderTimelineHeader
        orderId={order.id}
        status={order.status}
        createdAt={order.createdAt}
      />

      <OrderLifecycleTimeline stages={stages} />

      <View style={styles.section}>
        <OrderShopSummary
          shopName={shopName}
          deliverySchedule={deliverySchedule}
          salesExecutive={salesExecutive}
          warehouse={order.storeName}
        />
      </View>

      <View style={styles.section}>
        <OrderItemsCard lines={order.lines} />
      </View>

      <View style={styles.section}>
        <OrderPaymentSummary
          totals={order.totals}
          paymentMethod={order.paymentMethod}
          paymentStatus={order.paymentStatus}
        />
      </View>

      <View style={styles.section}>
        <OrderDeliveryInfo
          address={order.address}
          deliverySchedule={deliverySchedule}
        />
      </View>

      <View style={styles.section}>
        <OrderNotesCard notes={order.notes} />
      </View>

      <View style={styles.section}>
        <RepeatOrderBar
          onPress={() => router.push('/(tabs)/restock')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  section: {
    gap: 0,
  },
});
