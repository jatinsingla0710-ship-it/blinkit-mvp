import { StyleSheet, Text, View } from 'react-native';
import type { OrderStatus } from '@/types';
import { getOrderStatusLabel } from '@/services/order-timeline';
import { theme } from '@/constants/theme';

type Props = {
  orderId: string;
  status: OrderStatus;
  createdAt: string;
};

export function OrderTimelineHeader({ orderId, status, createdAt }: Props) {
  const placed = new Date(createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>Order</Text>
      <Text style={styles.id}>{orderId}</Text>
      <Text style={styles.status}>{getOrderStatusLabel(status)}</Text>
      <Text style={styles.meta}>Confirmed {placed}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginBottom: 8,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  id: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.4,
  },
  status: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});
