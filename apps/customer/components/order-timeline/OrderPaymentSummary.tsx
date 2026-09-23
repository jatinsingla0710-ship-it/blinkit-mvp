import { StyleSheet, Text, View } from 'react-native';
import type { OrderTotals, PaymentStatusUi } from '@/types';
import {
  paymentMethodLabel,
  paymentStatusLabel,
} from '@/services/order-timeline';
import { theme } from '@/constants/theme';

type Props = {
  totals: OrderTotals;
  paymentMethod: string;
  paymentStatus: PaymentStatusUi;
};

export function OrderPaymentSummary({
  totals,
  paymentMethod,
  paymentStatus,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Payment summary</Text>
      <View style={styles.row}>
        <Text style={styles.key}>Subtotal</Text>
        <Text style={styles.value}>
          ₹{totals.subtotal.toLocaleString('en-IN')}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.key}>Delivery</Text>
        <Text style={styles.value}>
          {totals.deliveryFee === 0
            ? 'Included'
            : `₹${totals.deliveryFee.toLocaleString('en-IN')}`}
        </Text>
      </View>
      {totals.handlingFee > 0 ? (
        <View style={styles.row}>
          <Text style={styles.key}>Handling</Text>
          <Text style={styles.value}>
            ₹{totals.handlingFee.toLocaleString('en-IN')}
          </Text>
        </View>
      ) : null}
      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.totalKey}>Order total</Text>
        <Text style={styles.totalValue}>
          ₹{totals.total.toLocaleString('en-IN')}
        </Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.key}>Payment method</Text>
        <Text style={styles.value}>{paymentMethodLabel(paymentMethod)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.key}>Payment status</Text>
        <Text
          style={[
            styles.value,
            paymentStatus === 'PAID' && styles.paid,
            paymentStatus === 'UNPAID' && styles.unpaid,
          ]}
        >
          {paymentStatusLabel(paymentStatus)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  key: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  totalRow: {
    marginTop: 4,
  },
  totalKey: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    letterSpacing: -0.3,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  paid: {
    color: theme.colors.success,
  },
  unpaid: {
    color: theme.colors.warning,
  },
});
