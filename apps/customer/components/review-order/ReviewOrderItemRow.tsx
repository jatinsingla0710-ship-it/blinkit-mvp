import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Product } from '@/types';
import { theme } from '@/constants/theme';

type Props = {
  product: Product;
  qty: number;
  onInc: () => void;
  onDec: () => void;
};

export function ReviewOrderItemRow({ product, qty, onInc, onDec }: Props) {
  const lineTotal = product.price * qty;
  const low = product.stock < qty;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.imageWrap}>
          <Text style={styles.emoji}>{product.imageEmoji}</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.grade} numberOfLines={1}>
            {product.grade ?? product.specification ?? product.unit}
          </Text>
          <Text style={styles.unit}>{product.unit}</Text>
          {low ? (
            <Text style={styles.warn}>Only {product.stock} available</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.bottom}>
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
              style={[styles.stepText, qty >= product.stock && { opacity: 0.35 }]}
            >
              +
            </Text>
          </Pressable>
        </View>

        <View style={styles.amounts}>
          <Text style={styles.unitPrice}>
            ₹{product.price.toLocaleString('en-IN')} / {product.unit}
          </Text>
          <Text style={styles.lineTotal}>
            ₹{lineTotal.toLocaleString('en-IN')}
          </Text>
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
  top: {
    flexDirection: 'row',
    gap: 12,
  },
  imageWrap: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26 },
  content: { flex: 1, minWidth: 0, gap: 2 },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.2,
  },
  grade: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  unit: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  warn: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.danger,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stepper: {
    minWidth: 112,
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
    minWidth: 24,
    textAlign: 'center',
  },
  amounts: {
    alignItems: 'flex-end',
    gap: 2,
  },
  unitPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  lineTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.2,
  },
});
