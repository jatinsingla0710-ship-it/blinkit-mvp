import { StyleSheet, Text, View } from 'react-native';
import type { OrderLine } from '@/types';
import { theme } from '@/constants/theme';

type Props = {
  lines: OrderLine[];
};

export function OrderItemsCard({ lines }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Order items</Text>
      {lines.map((line, index) => (
        <View
          key={`${line.productId}-${index}`}
          style={[styles.row, index === lines.length - 1 && styles.rowLast]}
        >
          <View style={styles.imageWrap}>
            <Text style={styles.emoji}>{line.imageEmoji}</Text>
          </View>
          <View style={styles.content}>
            <Text style={styles.name} numberOfLines={1}>
              {line.name}
            </Text>
            <Text style={styles.meta}>
              {line.qty} × ₹{line.price.toLocaleString('en-IN')} / {line.unit}
            </Text>
          </View>
          <Text style={styles.lineTotal}>
            ₹{(line.qty * line.price).toLocaleString('en-IN')}
          </Text>
        </View>
      ))}
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
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  imageWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  content: { flex: 1, minWidth: 0, gap: 2 },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  meta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  lineTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
});
