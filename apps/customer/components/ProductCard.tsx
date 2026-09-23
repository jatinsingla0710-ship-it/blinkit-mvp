import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Product } from '@/types';
import { theme } from '@/constants/theme';
import { QtyButton } from '@/components/QtyButton';

type Props = {
  product: Product;
  qty: number;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
  /** Blinkit-style tile (default) or compact list row. */
  layout?: 'grid' | 'row';
};

function stockLabel(product: Product): { text: string; tone: 'ok' | 'warn' | 'bad' } {
  if (product.stockStatus === 'OUT_OF_STOCK' || product.stock <= 0) {
    return { text: 'Out of stock', tone: 'bad' };
  }
  if (product.stockStatus === 'LOW_STOCK') {
    return { text: 'Low stock', tone: 'warn' };
  }
  return { text: 'In stock', tone: 'ok' };
}

export function ProductCard({
  product,
  qty,
  onAdd,
  onInc,
  onDec,
  layout = 'grid',
}: Props) {
  const router = useRouter();
  const stock = stockLabel(product);
  const oos = stock.tone === 'bad';

  if (layout === 'row') {
    return (
      <View style={[styles.rowCard, oos && styles.cardOos]}>
        <Pressable
          style={styles.rowBody}
          onPress={() => router.push(`/product/${product.id}`)}
        >
          <View style={styles.rowImage}>
            {product.imageUrl ? (
              <Image
                source={{ uri: product.imageUrl }}
                style={styles.rowPhoto}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.rowEmoji}>{product.imageEmoji}</Text>
            )}
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowName} numberOfLines={2}>
              {product.name}
            </Text>
            <Text style={styles.weight} numberOfLines={1}>
              {product.unit}
              {product.moq ? ` · MOQ ${product.moq}` : ''}
            </Text>
            <Text style={styles.price}>
              ₹{product.price.toLocaleString('en-IN')}
            </Text>
          </View>
        </Pressable>
        <View style={styles.rowAction}>
          {oos ? (
            <Text style={styles.oos}>Unavailable</Text>
          ) : (
            <QtyButton
              qty={qty}
              onAdd={onAdd}
              onInc={onInc}
              onDec={onDec}
              disabled={qty >= product.stock}
              compact
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.gridCard, oos && styles.cardOos]}>
      <Pressable onPress={() => router.push(`/product/${product.id}`)}>
        <View style={styles.imageWrap}>
          {product.imageUrl ? (
            <Image
              source={{ uri: product.imageUrl }}
              style={styles.photo}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.emoji}>{product.imageEmoji}</Text>
          )}
          {stock.tone === 'warn' ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Low stock</Text>
            </View>
          ) : null}
          <View style={styles.addOverlay}>
            {oos ? (
              <Text style={styles.oos}>NA</Text>
            ) : (
              <QtyButton
                qty={qty}
                onAdd={onAdd}
                onInc={onInc}
                onDec={onDec}
                disabled={qty >= product.stock}
                compact
              />
            )}
          </View>
        </View>
        <Text style={styles.weight} numberOfLines={1}>
          {product.unit}
          {product.moq ? ` · MOQ ${product.moq}` : ''}
        </Text>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.price}>₹{product.price.toLocaleString('en-IN')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cardOos: {
    opacity: 0.55,
  },
  gridCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 8,
    paddingBottom: 12,
    minWidth: 0,
  },
  imageWrap: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: 10,
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  photo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  emoji: {
    fontSize: 44,
  },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8A6D1B',
  },
  addOverlay: {
    position: 'absolute',
    right: 6,
    bottom: 6,
  },
  weight: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 17,
    minHeight: 34,
  },
  price: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  oos: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.danger,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  rowImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowPhoto: {
    width: 64,
    height: 64,
  },
  rowEmoji: {
    fontSize: 28,
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  rowAction: {
    justifyContent: 'center',
  },
});
