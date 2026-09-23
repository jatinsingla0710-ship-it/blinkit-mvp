import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
  qty: number;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
  disabled?: boolean;
  compact?: boolean;
};

export function QtyButton({
  qty,
  onAdd,
  onInc,
  onDec,
  disabled,
  compact,
}: Props) {
  if (qty <= 0) {
    return (
      <Pressable
        onPress={onAdd}
        disabled={disabled}
        style={({ pressed }) => [
          styles.addBtn,
          compact && styles.compact,
          disabled && styles.disabled,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.addText}>ADD</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.stepper, compact && styles.compact]}>
      <Pressable onPress={onDec} style={styles.stepHit} hitSlop={8}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.qty}>{qty}</Text>
      <Pressable
        onPress={onInc}
        disabled={disabled}
        style={styles.stepHit}
        hitSlop={8}
      >
        <Text style={[styles.stepText, disabled && { opacity: 0.4 }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    minWidth: 72,
    height: 34,
    borderRadius: theme.radius.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  compact: {
    minWidth: 64,
    height: 30,
  },
  addText: {
    color: theme.colors.primary,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  stepper: {
    minWidth: 88,
    height: 34,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  stepHit: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  qty: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    minWidth: 18,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
});
