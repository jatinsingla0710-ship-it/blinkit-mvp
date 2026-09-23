import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

/**
 * Legacy consumer timeline — unused after Order Timeline v1.
 * Prefer `OrderLifecycleTimeline`.
 */
export function StatusTimeline() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>Use OrderLifecycleTimeline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16 },
  text: { color: theme.colors.textMuted, fontSize: 12 },
});
