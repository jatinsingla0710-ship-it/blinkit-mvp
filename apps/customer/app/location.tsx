import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { presetAddresses } from '@/services/mock/data';
import { findNearestStore } from '@/services/mock/geo';
import { useLocationStore } from '@/store/location';
import { BrandLogo } from '@/components/BrandLogo';
import { theme } from '@/constants/theme';
import { isMockAdapterMode } from '@/config/env';

export default function LocationScreen() {
  const router = useRouter();
  const setAddress = useLocationStore((s) => s.setAddress);

  // Dark-store location picker is mock-adapter only.
  if (!isMockAdapterMode()) {
    return <Redirect href="/" />;
  }

  const choose = (id: string) => {
    const address = presetAddresses.find((a) => a.id === id);
    if (!address) return;
    setAddress(address);
    const result = findNearestStore(address.lat, address.lng);
    if (result.serviceable) {
      router.replace('/(tabs)');
    }
  };

  const current = useLocationStore();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoWrap}>
          <BrandLogo height={36} onDark={false} />
        </View>
        <Text style={styles.headline}>Delivery in minutes</Text>
        <Text style={styles.sub}>
          Pick a delivery pin. GroAurum matches the nearest hub and shows live stock
          with an honest ETA.
        </Text>

        <Text style={styles.section}>Choose a demo address</Text>
        {presetAddresses.map((addr) => {
          const result = findNearestStore(addr.lat, addr.lng);
          const selected = current.address?.id === addr.id;
          return (
            <Pressable
              key={addr.id}
              onPress={() => choose(addr.id)}
              style={({ pressed }) =>
                StyleSheet.flatten([
                  styles.card,
                  selected && styles.cardSelected,
                  pressed && styles.cardPressed,
                ])
              }
            >
              <View style={styles.cardTop}>
                <Text style={styles.label}>{addr.label}</Text>
                <View
                  style={[
                    styles.pill,
                    result.serviceable ? styles.pillOk : styles.pillBad,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      !result.serviceable && styles.pillTextBad,
                    ]}
                  >
                    {result.serviceable
                      ? `${result.store?.etaMinutes} min`
                      : 'Not serviceable'}
                  </Text>
                </View>
              </View>
              <Text style={styles.addr}>{addr.text}</Text>
              {result.serviceable && result.store ? (
                <Text style={styles.meta}>
                  {result.store.area} · {result.distanceKm} km away
                </Text>
              ) : (
                <Text style={styles.metaBad}>
                  Outside delivery radius — try a South Delhi pin
                </Text>
              )}
            </Pressable>
          );
        })}

        {current.address && !current.serviceable ? (
          <View style={styles.warn}>
            <Text style={styles.warnTitle}>We don’t deliver here yet</Text>
            <Text style={styles.warnBody}>
              GroAurum hubs around Saket, Okhla, and Greater Kailash — expand soon.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.yellow,
  },
  content: {
    padding: theme.spacing.xl,
    paddingBottom: 40,
    backgroundColor: theme.colors.yellow,
  },
  logoWrap: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  headline: {
    marginTop: 14,
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
  },
  sub: {
    marginTop: theme.spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xxl,
  },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  cardSelected: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillOk: {
    backgroundColor: theme.colors.accentSoft,
  },
  pillBad: {
    backgroundColor: theme.colors.dangerSoft,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.warning,
  },
  pillTextBad: {
    color: theme.colors.danger,
  },
  addr: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  meta: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  metaBad: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.danger,
  },
  warn: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dangerSoft,
  },
  warnTitle: {
    fontWeight: '800',
    color: theme.colors.danger,
    marginBottom: 4,
  },
  warnBody: {
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});
