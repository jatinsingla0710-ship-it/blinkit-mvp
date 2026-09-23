import { StyleSheet, Text, View } from 'react-native';
import type { TimelineStageView } from '@/services/order-timeline';
import { formatTimelineTimestamp } from '@/services/order-timeline';
import { theme } from '@/constants/theme';

type Props = {
  stages: TimelineStageView[];
};

export function OrderLifecycleTimeline({ stages }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>Fulfilment timeline</Text>
      {stages.map((stage, index) => {
        const isLast = index === stages.length - 1;
        const lineDone = stage.state === 'done';

        return (
          <View key={stage.status} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  stage.state === 'done' && styles.dotDone,
                  stage.state === 'current' && styles.dotCurrent,
                ]}
              />
              {!isLast ? (
                <View
                  style={[
                    styles.line,
                    lineDone && styles.lineDone,
                    stage.state === 'current' && styles.linePartial,
                  ]}
                />
              ) : null}
            </View>
            <View style={[styles.content, isLast && styles.contentLast]}>
              <Text
                style={[
                  styles.label,
                  stage.state !== 'upcoming' && styles.labelActive,
                ]}
              >
                {stage.label}
              </Text>
              {stage.at ? (
                <Text style={styles.time}>
                  {formatTimelineTimestamp(stage.at)}
                </Text>
              ) : stage.state === 'upcoming' ? (
                <Text style={styles.timeMuted}>Pending</Text>
              ) : null}
              {stage.state !== 'upcoming' ? (
                <Text style={styles.explanation}>{stage.explanation}</Text>
              ) : (
                <Text style={styles.explanationMuted}>{stage.explanation}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    minHeight: 64,
  },
  rail: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  dotDone: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  dotCurrent: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  lineDone: {
    backgroundColor: theme.colors.primary,
  },
  linePartial: {
    backgroundColor: theme.colors.primarySoft,
  },
  content: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
    gap: 4,
  },
  contentLast: {
    paddingBottom: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  labelActive: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primaryDark,
  },
  timeMuted: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  explanation: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  explanationMuted: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textMuted,
  },
});
