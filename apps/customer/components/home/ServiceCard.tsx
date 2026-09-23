import { StyleSheet, Text, View } from 'react-native';
import type { HomeServiceSummary } from '@/types';
import { theme } from '@/constants/theme';

type Props = {
  service: HomeServiceSummary;
};

export function ServiceCard({ service }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Next Delivery</Text>
      <Text style={styles.day}>{service.nextDeliveryLabel}</Text>
      <Text style={styles.slot}>{service.timeSlot}</Text>
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
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  day: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    letterSpacing: -0.4,
  },
  slot: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});
