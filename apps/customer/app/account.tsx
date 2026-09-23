import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCustomerSession } from '@/context/CustomerSessionProvider';
import { getSupabaseCustomerServices } from '@/services/adapters/factory';
import { isMockAdapterMode } from '@/config/env';
import { LoadingBlock } from '@/components/LoadingBlock';
import { theme } from '@/constants/theme';

type AddressRow = {
  id: string;
  label: string;
  address_line: string;
  city: string;
  state: string;
  pin_code: string;
  is_default: boolean;
};

async function fetchAccountAddresses(shopId: string): Promise<AddressRow[]> {
  const services = getSupabaseCustomerServices();
  if (!services?.client) return [];
  const { data, error } = await services.client
    .from('customer_addresses')
    .select('id, label, address_line, city, state, pin_code, is_default')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AddressRow[];
}

/**
 * Account — profile, addresses, logout. Opened from home header (tabs unchanged).
 */
export default function AccountScreen() {
  const router = useRouter();
  const { snapshot, signOut } = useCustomerSession();
  const shop = snapshot.shopContext?.shop;
  const profile = snapshot.profile;

  const addressesQuery = useQuery({
    queryKey: ['customer', 'account', 'addresses', shop?.id],
    queryFn: () => fetchAccountAddresses(shop!.id),
    enabled: !isMockAdapterMode() && !!shop?.id,
  });

  if (isMockAdapterMode()) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.body}>Account is available in Supabase mode.</Text>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!shop) {
    return <LoadingBlock label="Loading account…" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Account</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile</Text>
          <Text style={styles.row}>
            Owner · {profile?.displayName ?? '—'}
          </Text>
          <Text style={styles.row}>Phone · {snapshot.mobile ?? '—'}</Text>
          <Text style={styles.row}>Shop · {shop.tradeName}</Text>
          <Text style={styles.row}>Legal · {shop.legalName ?? '—'}</Text>
          <Text style={styles.row}>
            Service area · {shop.serviceAreaId ?? '—'}
          </Text>
          <Text style={styles.row}>
            Status · {shop.isActive ? 'Active' : 'Inactive'} · {shop.lifecycleStatus}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Primary delivery</Text>
          <Text style={styles.row}>{shop.deliveryAddressLine}</Text>
          <Text style={styles.row}>
            {shop.deliveryCity}, {shop.deliveryState} {shop.deliveryPinCode}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Addresses</Text>
          {addressesQuery.isLoading ? (
            <Text style={styles.row}>Loading…</Text>
          ) : (addressesQuery.data ?? []).length === 0 ? (
            <Text style={styles.row}>No additional addresses on file.</Text>
          ) : (
            (addressesQuery.data ?? []).map((addr) => (
              <View key={addr.id} style={styles.addressBlock}>
                <Text style={styles.row}>
                  {addr.label}
                  {addr.is_default ? ' · Default' : ''}
                </Text>
                <Text style={styles.muted}>
                  {addr.address_line}, {addr.city}, {addr.state} {addr.pin_code}
                </Text>
              </View>
            ))
          )}
        </View>

        <Pressable
          style={styles.button}
          onPress={async () => {
            await signOut();
            router.replace('/');
          }}
        >
          <Text style={styles.buttonText}>Log out</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  body: { color: theme.colors.textSecondary, marginBottom: 12 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    fontWeight: '800',
    color: theme.colors.primaryDark,
    marginBottom: 4,
  },
  row: { color: theme.colors.text, fontSize: 14 },
  muted: { color: theme.colors.textMuted, fontSize: 13 },
  addressBlock: { marginBottom: 8, gap: 2 },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '800' },
  secondary: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  secondaryText: { color: theme.colors.text, fontWeight: '700' },
});
