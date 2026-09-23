import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { CatalogueFilterChip, CatalogueFilterId } from '@/services/catalogue-browser';
import { theme } from '@/constants/theme';

type Props = {
  chips: CatalogueFilterChip[];
  selected: CatalogueFilterId;
  onSelect: (id: CatalogueFilterId) => void;
};

export function CatalogueFilterChips({ chips, selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {chips.map((chip) => {
        const active = chip.id === selected;
        return (
          <Pressable
            key={chip.id}
            onPress={() => onSelect(chip.id)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {chip.label}
            </Text>
          </Pressable>
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
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipActive: {
    backgroundColor: theme.colors.yellow,
    borderColor: theme.colors.yellow,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  labelActive: {
    color: theme.colors.text,
    fontWeight: '800',
  },
});
