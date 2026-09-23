/**
 * Delivery H5: honest customer-notification copy when SMS/WhatsApp is not wired.
 */

export function notificationHonestyLabel(providerConfigured: boolean): string {
  return providerConfigured
    ? 'Notification queued'
    : 'Notification not configured';
}

export function isDoubleAssignmentError(message: string): boolean {
  return /already assigned to another (route|active route)/i.test(message);
}
