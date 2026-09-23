import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

const GREEN = '#2DB85A';
const GREEN_DARK = '#0B5345';

type Props = {
  height?: number;
  /** Black plate behind wordmark (matches official logo art). */
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Static GroAurum wordmark — no SVG dependency (works on web + native).
 */
export function BrandLogo({ height = 40, onDark = true, style }: Props) {
  const fontSize = height * 0.72;
  const leafSize = Math.max(12, height * 0.42);

  return (
    <View
      style={[
        styles.wrap,
        onDark && styles.onDark,
        {
          paddingVertical: height * 0.18,
          paddingHorizontal: height * 0.28,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel="GroAurum"
    >
      <View style={styles.row}>
        <Text style={[styles.text, { fontSize, color: GREEN }]}>Gro</Text>
        <View style={styles.aBlock}>
          <Text style={[styles.leaf, { fontSize: leafSize, lineHeight: leafSize + 2 }]}>
            🍃
          </Text>
          <Text style={[styles.text, styles.aLetter, { fontSize, color: GREEN }]}>
            A
          </Text>
        </View>
        <Text style={[styles.text, { fontSize, color: GREEN_DARK }]}>urum</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    borderRadius: 8,
  },
  onDark: {
    backgroundColor: '#000000',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  text: {
    fontWeight: '800',
    letterSpacing: -0.6,
    includeFontPadding: false,
  },
  aBlock: {
    alignItems: 'center',
    marginHorizontal: -1,
  },
  leaf: {
    marginBottom: -4,
  },
  aLetter: {
    marginTop: -2,
  },
});
