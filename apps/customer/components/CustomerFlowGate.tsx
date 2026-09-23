import { Redirect, usePathname } from 'expo-router';
import { StyleSheet, Text, View, Pressable, TextInput } from 'react-native';
import { useEffect, useState } from 'react';
import { useCustomerSession } from '@/context/CustomerSessionProvider';
import { isMockAdapterMode } from '@/config/env';
import { useLocationStore } from '@/store/location';
import { LoadingBlock } from '@/components/LoadingBlock';
import { theme } from '@/constants/theme';

type AuthTab = 'phone' | 'email';

/**
 * Sprint 6 flow gate — auth (phone OTP / email) → invitation → shop → serviceability.
 * Layout panels preserved; no navigation redesign.
 */
export function CustomerFlowGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    mode,
    snapshot,
    signInWithEmailPassword,
    requestPhoneOtp,
    verifyPhoneOtp,
    linkVerifiedMobile,
    acceptShopInvitation,
    signOut,
  } = useCustomerSession();
  const address = useLocationStore((s) => s.address);
  const serviceable = useLocationStore((s) => s.serviceable);

  const [authTab, setAuthTab] = useState<AuthTab>('phone');
  const [email, setEmail] = useState('customer@groaurum.local');
  const [password, setPassword] = useState('password123');
  const [mobile, setMobile] = useState('+919811122233');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [shopChoices, setShopChoices] = useState<
    { shopId: string; shopName: string }[]
  >([]);
  const [linkAttempted, setLinkAttempted] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (snapshot.phase !== 'AUTHENTICATED_NO_SHOP_LINK' || linkAttempted) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLinkAttempted(true);
      try {
        const result = await linkVerifiedMobile();
        if (
          !cancelled &&
          !result.linked &&
          result.reason === 'multiple_shops'
        ) {
          setShopChoices(result.choices ?? []);
        }
      } catch {
        if (!cancelled) {
          setLinkAttempted(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshot.phase, linkAttempted, linkVerifiedMobile]);

  if (isMockAdapterMode() || mode === 'mock') {
    const onLocationScreen =
      pathname === '/location' || pathname?.endsWith('/location');
    if ((!address || !serviceable) && !onLocationScreen) {
      return <Redirect href="/location" />;
    }
    return <>{children}</>;
  }

  if (
    snapshot.phase === 'AUTH_LOADING' ||
    snapshot.phase === 'LINKED_SHOP_LOADING'
  ) {
    return (
      <View style={styles.center}>
        <LoadingBlock label="Loading your shop account…" />
      </View>
    );
  }

  if (snapshot.phase === 'UNAUTHENTICATED') {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.body}>
          Phone OTP (production) or email/password (local). Session restores automatically.
        </Text>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, authTab === 'email' && styles.tabActive]}
            onPress={() => setAuthTab('email')}
          >
            <Text style={styles.tabText}>Email</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, authTab === 'phone' && styles.tabActive]}
            onPress={() => setAuthTab('phone')}
          >
            <Text style={styles.tabText}>Phone OTP</Text>
          </Pressable>
        </View>

        {authTab === 'email' ? (
          <>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              secureTextEntry
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
            />
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              placeholder="Mobile (+91…)"
              value={mobile}
              onChangeText={setMobile}
            />
            {otpSent ? (
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder="OTP code"
                value={otp}
                onChangeText={setOtp}
              />
            ) : null}
          </>
        )}

        {authError ? <Text style={styles.error}>{authError}</Text> : null}

        <Pressable
          style={styles.button}
          disabled={submitting}
          onPress={async () => {
            setSubmitting(true);
            setAuthError(null);
            try {
              if (authTab === 'email') {
                await signInWithEmailPassword(email.trim(), password);
              } else if (!otpSent) {
                await requestPhoneOtp(mobile.trim());
                setOtpSent(true);
              } else {
                await verifyPhoneOtp(mobile.trim(), otp.trim());
              }
            } catch (error) {
              setAuthError(error instanceof Error ? error.message : 'Sign-in failed');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Text style={styles.buttonText}>
            {submitting
              ? 'Please wait…'
              : authTab === 'email'
                ? 'Sign in'
                : otpSent
                  ? 'Verify OTP'
                  : 'Send OTP'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (snapshot.phase === 'AUTHENTICATED_NO_SHOP_LINK') {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>Link your business</Text>
        <Text style={styles.body}>
          We use your verified mobile number to connect this login to your shop
          account. If you received an invitation token, you can use that instead.
        </Text>

        {shopChoices.length > 0 ? (
          <>
            <Text style={styles.body}>
              Your mobile number is associated with multiple businesses. Select
              yours:
            </Text>
            {shopChoices.map((choice) => (
              <Pressable
                key={choice.shopId}
                style={styles.secondaryButton}
                disabled={submitting}
                onPress={async () => {
                  setSubmitting(true);
                  setAuthError(null);
                  try {
                    await linkVerifiedMobile(choice.shopId);
                  } catch (error) {
                    setAuthError(
                      error instanceof Error
                        ? error.message
                        : 'Could not link business',
                    );
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                <Text style={styles.secondaryButtonText}>{choice.shopName}</Text>
              </Pressable>
            ))}
          </>
        ) : null}

        <TextInput
          style={styles.input}
          autoCapitalize="none"
          placeholder="Invitation token (optional)"
          value={inviteToken}
          onChangeText={setInviteToken}
        />
        {authError ? <Text style={styles.error}>{authError}</Text> : null}
        <Pressable
          style={styles.button}
          disabled={submitting || !inviteToken.trim()}
          onPress={async () => {
            setSubmitting(true);
            setAuthError(null);
            try {
              await acceptShopInvitation(inviteToken.trim());
            } catch (error) {
              setAuthError(
                error instanceof Error ? error.message : 'Invitation accept failed',
              );
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Text style={styles.buttonText}>
            {submitting ? 'Activating…' : 'Use invitation token'}
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => void signOut()}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  if (snapshot.phase === 'LINKED_SHOP_INACTIVE_OR_BLOCKED') {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>Shop unavailable</Text>
        <Text style={styles.body}>
          {snapshot.shopContext?.shop.tradeName ?? 'Your shop'} is inactive or blocked.
          Contact GroAurum support to restore access.
        </Text>
        <Pressable style={styles.secondaryButton} onPress={() => void signOut()}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  if (snapshot.phase === 'ERROR') {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          {snapshot.errorMessage ?? 'Unable to load your customer account.'}
        </Text>
        <Pressable style={styles.secondaryButton} onPress={() => void signOut()}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  if (
    snapshot.phase === 'LINKED_SHOP_READY' &&
    snapshot.serviceability &&
    !snapshot.serviceability.serviceable
  ) {
    const onApproval =
      pathname?.includes('/order-approval/') ?? false;
    if (!onApproval) {
      return (
        <View style={styles.panel}>
          <Text style={styles.title}>Area not currently serviceable</Text>
          <Text style={styles.body}>
            {snapshot.serviceability.message ??
              `We cannot deliver to PIN ${snapshot.shopContext?.shop.deliveryPinCode ?? ''} yet.`}
          </Text>
          <Pressable style={styles.secondaryButton} onPress={() => void signOut()}>
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </Pressable>
        </View>
      );
    }
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  panel: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  title: {
    fontSize: theme.font.title,
    fontWeight: '800',
    color: theme.colors.text,
  },
  body: {
    fontSize: theme.font.body,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  tabActive: {
    borderColor: theme.colors.yellow,
    backgroundColor: theme.colors.yellowSoft,
  },
  tabText: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    color: theme.colors.text,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  error: {
    color: theme.colors.danger,
    fontSize: 13,
  },
});
