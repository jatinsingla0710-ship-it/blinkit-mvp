import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

export function LoadingBlock({ label }: { label?: string } = {}) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.font.body,
    textAlign: 'center',
  },
});
