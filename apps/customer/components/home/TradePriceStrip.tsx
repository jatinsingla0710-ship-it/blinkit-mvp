import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TradePriceMovement } from '@/types';
import { theme } from '@/constants/theme';

type Props = {
  items: TradePriceMovement[];
};

export function TradePriceStrip({ items }: Props) {
  if (!items.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {items.map((item) => {
        const up = item.changeAmount > 0;
        const flat = item.changeAmount === 0;
        const tone = flat ? 'flat' : up ? 'up' : 'down';
        const sign = flat ? '' : up ? '+' : '−';
        const amount = Math.abs(item.changeAmount);
        const pct = Math.abs(item.changePercent);

        return (
          <View key={item.id} style={styles.card}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.price}>
              ₹{item.tradePrice.toLocaleString('en-IN')}
              <Text style={styles.unit}> / {item.unit}</Text>
            </Text>
            <View style={styles.moveRow}>
              <Text
                style={[
                  styles.move,
                  tone === 'up' && styles.moveUp,
                  tone === 'down' && styles.moveDown,
                  tone === 'flat' && styles.moveFlat,
                ]}
              >
                {flat ? 'Unchanged today' : `${sign}₹${amount} · ${sign}${pct}%`}
              </Text>
            </View>
            {!flat ? (
              <Text style={styles.today}>
                Today {up ? 'increase' : 'decrease'}
              </Text>
            ) : (
              <Text style={styles.today}>Today</Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingRight: 8,
  },
  card: {
    width: 148,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  price: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  unit: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  moveRow: {
    marginTop: 4,
  },
  move: {
    fontSize: 12,
    fontWeight: '700',
  },
  moveUp: {
    color: theme.colors.danger,
  },
  moveDown: {
    color: theme.colors.primary,
  },
  moveFlat: {
    color: theme.colors.textMuted,
  },
  today: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
