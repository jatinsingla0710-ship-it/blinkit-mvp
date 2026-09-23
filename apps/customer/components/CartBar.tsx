import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useCartItemCount } from '@/store/hooks';

type Props = {
  total?: number;
  etaMinutes?: number;
};

export function CartBar({ total = 0 }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const itemCount = useCartItemCount();

  if (itemCount <= 0) return null;

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <Pressable
        style={({ pressed }) => [styles.bar, pressed && { opacity: 0.94 }]}
        onPress={() => router.push('/cart')}
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{itemCount}</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.count}>
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </Text>
          <Text style={styles.total}>₹{total.toLocaleString('en-IN')}</Text>
        </View>
        <Text style={styles.cta}>View cart  ›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  bar: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  copy: {
    flex: 1,
  },
  count: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
  },
  total: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 1,
  },
  cta: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
