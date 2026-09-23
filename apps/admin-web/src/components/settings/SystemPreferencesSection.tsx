import type { SystemPreferences } from '@/data/settings-types';
import { Field, FieldGrid } from '@groaurum/ui';

type Props = {
  preferences: SystemPreferences;
};

export function SystemPreferencesSection({ preferences }: Props) {
  return (
    <FieldGrid columns={4}>
      <Field label="Currency">{preferences.currencyLabel}</Field>
      <Field label="Timezone">{preferences.timezoneLabel}</Field>
      <Field label="Date Format">{preferences.dateFormatLabel}</Field>
      <Field label="Language">{preferences.languageLabel}</Field>
    </FieldGrid>
  );
}
