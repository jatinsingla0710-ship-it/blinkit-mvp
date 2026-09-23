import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '@/constants/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
};

export function CatalogueSearchBar({ value, onChangeText }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search products"
        placeholderTextColor={theme.colors.textMuted}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  icon: {
    fontSize: 18,
    color: theme.colors.textMuted,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    paddingVertical: 0,
  },
});
