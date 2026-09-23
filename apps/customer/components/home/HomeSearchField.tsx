import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
  onPress: () => void;
};

export function HomeSearchField({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.94 }]}
      accessibilityRole="search"
    >
      <Text style={styles.icon}>⌕</Text>
      <Text style={styles.placeholder} numberOfLines={1}>
        Search products
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  icon: {
    fontSize: 18,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  placeholder: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
});
