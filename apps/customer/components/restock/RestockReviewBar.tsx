import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

type Props = {
  total: number;
  unitCount: number;
  disabled?: boolean;
  onPress: () => void;
};

export function RestockReviewBar({ total, unitCount, disabled, onPress }: Props) {
  const insets = useSafeAreaInsets();

  if (unitCount <= 0) return null;

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <Pressable
        disabled={disabled}
        style={({ pressed }) => [
          styles.bar,
          pressed && { opacity: 0.94 },
          disabled && { opacity: 0.5 },
        ]}
        onPress={onPress}
      >
        <View>
          <Text style={styles.count}>
            {unitCount} unit{unitCount === 1 ? '' : 's'} to restock
          </Text>
          <Text style={styles.total}>₹{total.toLocaleString('en-IN')}</Text>
        </View>
        <Text style={styles.cta}>Review order</Text>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  bar: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '600',
  },
  total: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  cta: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
