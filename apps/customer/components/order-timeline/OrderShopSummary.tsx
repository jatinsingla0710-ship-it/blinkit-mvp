import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
  shopName: string;
  deliverySchedule: string;
  salesExecutive: string;
  warehouse: string;
};

export function OrderShopSummary({
  shopName,
  deliverySchedule,
  salesExecutive,
  warehouse,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Shop summary</Text>
      <Text style={styles.shopName}>{shopName}</Text>
      <View style={styles.row}>
        <Text style={styles.metaLabel}>Delivery window</Text>
        <Text style={styles.metaValue}>{deliverySchedule}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.metaLabel}>Sales executive</Text>
        <Text style={styles.metaValue}>{salesExecutive}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.metaLabel}>Warehouse</Text>
        <Text style={styles.metaValue}>{warehouse}</Text>
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
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  shopName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  metaValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
