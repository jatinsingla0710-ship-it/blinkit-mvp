import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { OrderApprovalPreview } from '@groaurum/api-client';
import { getSupabaseCustomerServices } from '@/services/adapters/factory';
import { theme } from '@/constants/theme';

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Mobile-first assisted order approval.
 * Requires authenticated customer linked to the order shop.
 */
export default function OrderApprovalScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<OrderApprovalPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [showChanges, setShowChanges] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setError('Missing approval link.');
      setLoading(false);
      return;
    }
    const services = getSupabaseCustomerServices();
    if (!services) {
      setError('Live customer services are not configured.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await services.assistedOrder.getApprovalPreviewByToken(token);
      if (!data) {
        setError('Approval request not found.');
        setPreview(null);
      } else {
        setPreview(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approval');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onApprove() {
    if (!token || !preview?.canAct) return;
    const services = getSupabaseCustomerServices();
    if (!services) return;
    setSubmitting(true);
    setError(null);
    try {
      const orderId = await services.assistedOrder.approveByToken(token);
      router.replace(`/order/${orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function onRequestChanges() {
    if (!token || !preview?.canAct) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError('Please enter a short reason for the changes.');
      return;
    }
    const services = getSupabaseCustomerServices();
    if (!services) return;
    setSubmitting(true);
    setError(null);
    try {
      const orderId = await services.assistedOrder.requestChangesByToken(
        token,
        trimmed,
      );
      router.replace(`/order/${orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.muted}>Loading order…</Text>
      </View>
    );
  }

  if (!preview) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Unable to open approval</Text>
        <Text style={styles.error}>{error ?? 'Unknown error'}</Text>
      </View>
    );
  }

  const { order, shop, lines, canAct, expired } = preview;
  const discount =
    order.adjustments < 0 ? Math.abs(order.adjustments) : order.adjustments;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.kicker}>Review order</Text>
      <Text style={styles.title}>{shop.tradeName}</Text>
      <Text style={styles.meta}>Order {order.id.slice(0, 8).toUpperCase()}</Text>
      <Text style={styles.meta}>
        Status: {order.status.replaceAll('_', ' ')}
      </Text>

      <View style={styles.card}>
        <Text style={styles.section}>Delivery</Text>
        <Text style={styles.body}>
          {shop.deliveryAddressLine}
          {'\n'}
          {shop.deliveryCity}, {shop.deliveryState} {shop.deliveryPinCode}
        </Text>
        {order.expectedDeliveryAt ? (
          <Text style={styles.meta}>
            Expected:{' '}
            {new Date(order.expectedDeliveryAt).toLocaleString('en-IN')}
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Items</Text>
        {lines.map((line) => (
          <View key={line.id} style={styles.line}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineName}>{line.productName}</Text>
              <Text style={styles.meta}>
                {line.quantity} {line.sellingUnit} × {formatInr(line.unitPrice)}
              </Text>
            </View>
            <Text style={styles.lineTotal}>{formatInr(line.lineTotal)}</Text>
          </View>
        ))}
        <View style={styles.totals}>
          <Row label="Subtotal" value={formatInr(order.subtotal)} />
          {discount !== 0 ? (
            <Row
              label={order.adjustments < 0 ? 'Discount' : 'Adjustments'}
              value={formatInr(Math.abs(order.adjustments))}
            />
          ) : null}
          <Row label="Total" value={formatInr(order.total)} bold />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {expired || !canAct ? (
        <Text style={styles.muted}>
          {expired
            ? 'This approval link has expired. Ask your salesman to reissue approval.'
            : `This order cannot be actioned (challenge: ${preview.challenge.status}).`}
        </Text>
      ) : (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            disabled={submitting}
            onPress={() => void onApprove()}
          >
            <Text style={styles.btnPrimaryText}>
              {submitting ? 'Working…' : 'Approve Order'}
            </Text>
          </Pressable>

          {!showChanges ? (
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              disabled={submitting}
              onPress={() => setShowChanges(true)}
            >
              <Text style={styles.btnSecondaryText}>Request Changes</Text>
            </Pressable>
          ) : (
            <View style={styles.changesBox}>
              <Text style={styles.section}>What should change?</Text>
              <TextInput
                style={styles.input}
                multiline
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Reduce rice quantity to 10 bags"
                placeholderTextColor={theme.colors.textMuted}
              />
              <Pressable
                style={[styles.btn, styles.btnSecondary]}
                disabled={submitting}
                onPress={() => void onRequestChanges()}
              >
                <Text style={styles.btnSecondaryText}>
                  {submitting ? 'Sending…' : 'Submit Change Request'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.meta, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.lineTotal, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
    backgroundColor: theme.colors.background,
  },
  kicker: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  body: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  section: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  lineName: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  lineTotal: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  totals: { gap: 6, marginTop: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bold: { fontWeight: '800', color: theme.colors.text, fontSize: 16 },
  actions: { gap: 10, marginTop: 8 },
  btn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: theme.colors.primary },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  btnSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnSecondaryText: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  changesBox: { gap: 8 },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  error: { color: theme.colors.danger, fontSize: 14 },
  muted: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center' },
});
