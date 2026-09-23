import { Redirect } from 'expo-router';
import { useCustomerSession } from '@/context/CustomerSessionProvider';
import { isMockAdapterMode } from '@/config/env';
import { useLocationStore } from '@/store/location';

export default function Index() {
  const { snapshot } = useCustomerSession();

  if (isMockAdapterMode()) {
    const address = useLocationStore.getState().address;
    const serviceable = useLocationStore.getState().serviceable;
    if (!address || !serviceable) {
      return <Redirect href="/location" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  if (
    snapshot.phase === 'LINKED_SHOP_READY' &&
    snapshot.serviceability?.serviceable
  ) {
    return <Redirect href="/(tabs)" />;
  }

  // Gate UI is rendered by CustomerFlowGate for other phases.
  return null;
}
