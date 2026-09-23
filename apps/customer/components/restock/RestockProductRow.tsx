import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RestockSuggestion } from '@/types';
import { theme } from '@/constants/theme';

type Props = {
  suggestion: RestockSuggestion;
  qty: number;
  onInc: () => void;
  onDec: () => void;
};

function stockLabel(status: RestockSuggestion['product']['stockStatus']) {
  if (status === 'OUT_OF_STOCK') return { text: 'Out of stock', tone: 'bad' as const };
  if (status === 'LOW_STOCK') return { text: 'Low stock', tone: 'warn' as const };
  return { text: 'In stock', tone: 'ok' as const };
}

export function RestockProductRow({ suggestion, qty, onInc, onDec }: Props) {
  const { product, lastOrderedQty, suggestedQty } = suggestion;
  const stock = stockLabel(product.stockStatus);
  const oos = stock.tone === 'bad';

  return (
    <View style={[styles.card, oos && styles.cardOos]}>
      <View style={styles.top}>
        <View style={styles.imageWrap}>
          <Text style={styles.emoji}>{product.imageEmoji}</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.spec} numberOfLines={1}>
            {[product.grade, product.specification].filter(Boolean).join(' · ') ||
              product.unit}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>Last {lastOrderedQty}</Text>
            <Text style={styles.meta}>Suggested {suggestedQty}</Text>
            <Text
              style={[
                styles.stock,
                stock.tone === 'ok' && styles.stockOk,
                stock.tone === 'warn' && styles.stockWarn,
                stock.tone === 'bad' && styles.stockBad,
              ]}
            >
              {stock.text}
            </Text>
          </View>
          <Text style={styles.price}>
            ₹{product.price.toLocaleString('en-IN')}
            <Text style={styles.unit}> / {product.unit}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        {oos ? (
          <Text style={styles.unavailable}>Unavailable</Text>
        ) : (
          <View style={styles.stepper}>
            <Pressable onPress={onDec} style={styles.stepHit} hitSlop={8}>
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.qty}>{qty}</Text>
            <Pressable
              onPress={onInc}
              disabled={qty >= product.stock}
              style={styles.stepHit}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.stepText,
                  qty >= product.stock && { opacity: 0.35 },
                ]}
              >
                +
              </Text>
            </Pressable>
          </View>
        )}
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
  cardOos: {
    opacity: 0.72,
  },
  top: {
    flexDirection: 'row',
    gap: 12,
  },
  imageWrap: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.2,
  },
  spec: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  meta: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  stock: {
    fontSize: 11,
    fontWeight: '700',
  },
  stockOk: { color: theme.colors.primary },
  stockWarn: { color: theme.colors.warning },
  stockBad: { color: theme.colors.danger },
  price: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.2,
  },
  unit: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  actionRow: {
    alignItems: 'flex-end',
  },
  stepper: {
    minWidth: 120,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  stepHit: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  qty: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    minWidth: 28,
    textAlign: 'center',
  },
  unavailable: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.danger,
    paddingVertical: 8,
  },
});
