import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CatalogueSortId, CatalogueSortOption } from '@/services/catalogue-browser';
import { theme } from '@/constants/theme';

type Props = {
  options: CatalogueSortOption[];
  selected: CatalogueSortId;
  onSelect: (id: CatalogueSortId) => void;
  resultCount: number;
};

export function CatalogueSortBar({
  options,
  selected,
  onSelect,
  resultCount,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.count}>
        {resultCount} SKU{resultCount === 1 ? '' : 's'}
      </Text>
      <View style={styles.sorts}>
        <Text style={styles.sortLabel}>Sort</Text>
        {options.map((option) => {
          const active = option.id === selected;
          return (
            <Pressable
              key={option.id}
              onPress={() => onSelect(option.id)}
              style={({ pressed }) => [
                styles.option,
                active && styles.optionActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  sorts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginRight: 4,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  optionActive: {
    backgroundColor: theme.colors.yellow,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  optionTextActive: {
    color: theme.colors.text,
    fontWeight: '800',
  },
});
