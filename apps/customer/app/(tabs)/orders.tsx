import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchCustomerOrders,
  getCustomerOrderStatusLabel,
} from '@/services/customer-orders';
import { useCatalogueScope } from '@/hooks/useCatalogueScope';
import { EmptyState } from '@/components/EmptyState';
import { LoadingBlock } from '@/components/LoadingBlock';
import { theme } from '@/constants/theme';

export default function OrdersScreen() {
  const router = useRouter();
  const { scopeId, ready } = useCatalogueScope();

  const ordersQuery = useQuery({
    queryKey: ['customer', 'orders', scopeId],
    queryFn: () => fetchCustomerOrders(scopeId!),
    enabled: ready && !!scopeId,
    refetchInterval: 4000,
  });

  if (!ready || !scopeId || ordersQuery.isLoading) return <LoadingBlock />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Orders</Text>
      <FlatList
        data={ordersQuery.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            emoji="📦"
            title="No orders yet"
            subtitle="Confirm a wholesale order to follow its fulfilment timeline here."
            actionLabel="Browse catalogue"
            onAction={() => router.push('/(tabs)/catalogue')}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/order/${item.id}`)}
          >
            <View style={styles.row}>
              <Text style={styles.id}>{item.id.slice(0, 8).toUpperCase()}</Text>
              <Text style={styles.status}>
                {getCustomerOrderStatusLabel(item.status)}
              </Text>
            </View>
            <Text style={styles.meta}>
              {item.lines.length} item{item.lines.length > 1 ? 's' : ''} · ₹
              {item.totals.total}
            </Text>
            <Text style={styles.addr} numberOfLines={1}>
              {item.address.label} · {item.address.text}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  list: { padding: theme.spacing.lg, flexGrow: 1 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  id: { fontWeight: '800', color: theme.colors.text },
  status: {
    fontWeight: '700',
    color: theme.colors.primary,
    fontSize: 12,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginBottom: 4,
  },
  addr: { color: theme.colors.textMuted, fontSize: 12 },
});
