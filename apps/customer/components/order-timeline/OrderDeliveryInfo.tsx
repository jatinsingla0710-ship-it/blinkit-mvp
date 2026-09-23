import { StyleSheet, Text, View } from 'react-native';
import type { Address } from '@/types';
import { theme } from '@/constants/theme';

type Props = {
  address: Address;
  deliverySchedule: string;
};

export function OrderDeliveryInfo({ address, deliverySchedule }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Delivery information</Text>
      <Text style={styles.title}>{address.label}</Text>
      <Text style={styles.body}>{address.text}</Text>
      <View style={styles.row}>
        <Text style={styles.metaLabel}>Scheduled window</Text>
        <Text style={styles.metaValue}>{deliverySchedule}</Text>
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
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
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
