import { Redirect } from 'expo-router';

/**
 * Legacy checkout route — Review Order v1 consolidates confirmation on /cart.
 */
export default function CheckoutRedirect() {
  return <Redirect href="/cart" />;
}
