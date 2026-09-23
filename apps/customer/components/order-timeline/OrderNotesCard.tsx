import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
  notes?: string;
};

export function OrderNotesCard({ notes }: Props) {
  const text = notes?.trim();
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Notes</Text>
      <Text style={text ? styles.body : styles.empty}>
        {text || 'No notes on this order.'}
      </Text>
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
  body: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.text,
  },
  empty: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textMuted,
  },
});
