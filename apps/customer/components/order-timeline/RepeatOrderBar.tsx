import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
  onPress: () => void;
};

/**
 * Starts a new draft via Restock — does not reopen the historical order.
 */
export function RepeatOrderBar({ onPress }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        Creates a new draft from Restock. This does not reopen the past order.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={onPress}
      >
        <Text style={styles.buttonText}>Repeat Order</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    paddingTop: 8,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
