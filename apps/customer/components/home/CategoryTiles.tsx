import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category } from '@/types';
import { theme } from '@/constants/theme';

type Props = {
  categories: Category[];
  onSelect: (categoryId: string) => void;
};

const TILE_BG = ['#FFF4C4', '#E8F6EE', '#FDECEC', '#E8F0FE', '#F3E8FF', '#FFF0E0'];

export function CategoryTiles({ categories, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {categories.map((cat, index) => (
        <Pressable
          key={cat.id}
          onPress={() => onSelect(cat.id)}
          style={({ pressed }) => [styles.tile, pressed && { opacity: 0.88 }]}
        >
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: TILE_BG[index % TILE_BG.length] },
            ]}
          >
            <Text style={styles.icon}>{cat.emoji}</Text>
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {cat.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 6,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 28,
  },
  name: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 14,
  },
});
