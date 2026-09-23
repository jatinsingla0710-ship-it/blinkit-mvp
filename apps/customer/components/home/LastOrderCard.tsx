import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HomeLastOrderSummary } from '@/types';
import { theme } from '@/constants/theme';

type Props = {
  order: HomeLastOrderSummary;
  onPress?: () => void;
};

export function LastOrderCard({ order, onPress }: Props) {
  const paid = order.paymentStatus === 'PAID';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && onPress && { opacity: 0.94 }]}
    >
      <Text style={styles.label}>Last order</Text>
      <View style={styles.row}>
        <View style={styles.statuses}>
          <Text style={styles.fulfillment}>{order.fulfillmentLabel}</Text>
          <View style={[styles.pill, paid ? styles.pillPaid : styles.pillUnpaid]}>
            <Text style={[styles.pillText, paid ? styles.pillTextPaid : styles.pillTextUnpaid]}>
              {paid ? 'Paid' : order.paymentStatus === 'PENDING' ? 'Pending' : 'Unpaid'}
            </Text>
          </View>
        </View>
        <Text style={styles.total}>₹{order.total.toLocaleString('en-IN')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statuses: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  fulfillment: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.2,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillPaid: {
    backgroundColor: theme.colors.primarySoft,
  },
  pillUnpaid: {
    backgroundColor: theme.colors.dangerSoft,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pillTextPaid: {
    color: theme.colors.primaryDark,
  },
  pillTextUnpaid: {
    color: theme.colors.danger,
  },
  total: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
});
