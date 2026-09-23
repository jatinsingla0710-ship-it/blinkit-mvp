import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
  totalItems: number;
  estimatedValue: number;
};

export function ReviewOrderSummaryCard({ totalItems, estimatedValue }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Order summary</Text>
      <View style={styles.row}>
        <Text style={styles.key}>Total items</Text>
        <Text style={styles.value}>{totalItems}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.key}>Estimated value</Text>
        <Text style={styles.total}>₹{estimatedValue.toLocaleString('en-IN')}</Text>
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
  },
  key: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  total: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    letterSpacing: -0.3,
  },
});
