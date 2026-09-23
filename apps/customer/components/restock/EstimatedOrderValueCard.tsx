import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
  estimatedValue: number;
  selectedSkuCount: number;
};

export function EstimatedOrderValueCard({
  estimatedValue,
  selectedSkuCount,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Estimated order value</Text>
      <Text style={styles.value}>₹{estimatedValue.toLocaleString('en-IN')}</Text>
      <Text style={styles.hint}>
        {selectedSkuCount === 0
          ? 'Adjust quantities to build this restock'
          : `${selectedSkuCount} SKU${selectedSkuCount === 1 ? '' : 's'} selected`}
      </Text>
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
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  value: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    letterSpacing: -0.5,
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});
