import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
  skuCount: number;
  totalUnits: number;
};

export function RestockSummaryCard({ skuCount, totalUnits }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Restock summary</Text>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.value}>{skuCount}</Text>
          <Text style={styles.hint}>SKUs to reorder</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.value}>{totalUnits}</Text>
          <Text style={styles.hint}>Suggested units</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 12,
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
  },
  stat: {
    flex: 1,
    gap: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    letterSpacing: -0.4,
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.border,
    marginHorizontal: 16,
  },
});
