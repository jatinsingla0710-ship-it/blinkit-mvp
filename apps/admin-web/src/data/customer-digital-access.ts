/**
 * Separates wholesale customer business status from Customer App access.
 *
 * Business status: shops.is_active + lifecycle INACTIVE_OR_FOLLOW_UP
 * App access: shop_auth_links (activated) + last_app_link_sent_at (app link sent)
 */

export type CustomerBusinessStatus = 'active' | 'inactive';

/** Customer App access — plain language for Admin/Salesman UI. */
export type DigitalAccessStatus =
  | 'not_activated'
  | 'app_link_sent'
  | 'activated'
  | 'access_disabled';

export interface CustomerDigitalAccessVm {
  status: DigitalAccessStatus;
  label: string;
  description: string;
  tone: 'default' | 'positive' | 'warning' | 'muted' | 'info';
  appLinkSentAtLabel?: string;
  appLinkSentByLabel?: string;
  activatedAtLabel?: string;
  mobileLabel?: string;
}

export function deriveCustomerBusinessStatus(input: {
  isActive: boolean;
  lifecycleStatus: string;
}): CustomerBusinessStatus {
  if (!input.isActive || input.lifecycleStatus === 'INACTIVE_OR_FOLLOW_UP') {
    return 'inactive';
  }
  return 'active';
}

export function customerBusinessStatusLabel(status: CustomerBusinessStatus): string {
  return status === 'active' ? 'Active' : 'Inactive';
}

export function deriveDigitalAccessStatus(input: {
  isActive: boolean;
  hasAuthLink: boolean;
  hasAppLinkSent: boolean;
}): DigitalAccessStatus {
  if (!input.isActive) return 'access_disabled';
  if (input.hasAuthLink) return 'activated';
  if (input.hasAppLinkSent) return 'app_link_sent';
  return 'not_activated';
}

export function buildDigitalAccessVm(input: {
  isActive: boolean;
  hasAuthLink: boolean;
  hasAppLinkSent: boolean;
  primaryMobile?: string | null;
  appLinkSentAtLabel?: string | null;
  appLinkSentByLabel?: string | null;
  activatedAtLabel?: string | null;
}): CustomerDigitalAccessVm {
  const status = deriveDigitalAccessStatus(input);

  switch (status) {
    case 'activated':
      return {
        status,
        label: 'Activated',
        description:
          'This customer has successfully logged into the Customer App.',
        tone: 'positive',
        activatedAtLabel: input.activatedAtLabel ?? undefined,
        mobileLabel: input.primaryMobile ?? undefined,
      };
    case 'app_link_sent':
      return {
        status,
        label: 'App Link Sent',
        description:
          'The app link was sent, but the customer has not logged in yet.',
        tone: 'info',
        appLinkSentAtLabel: input.appLinkSentAtLabel ?? undefined,
        appLinkSentByLabel: input.appLinkSentByLabel ?? undefined,
        mobileLabel: input.primaryMobile ?? undefined,
      };
    case 'access_disabled':
      return {
        status,
        label: 'Access Disabled',
        description:
          'Customer business record is inactive. Customer App access is blocked.',
        tone: 'muted',
      };
    default:
      return {
        status: 'not_activated',
        label: 'Not Activated',
        description:
          'This customer has not logged into the Customer App yet. Orders and delivery can still proceed.',
        tone: 'default',
        mobileLabel: input.primaryMobile ?? undefined,
      };
  }
}

export function digitalAccessFilterId(status: DigitalAccessStatus): string {
  return status;
}

/** @deprecated Use not_activated */
export type LegacyDigitalAccessStatus =
  | 'not_invited'
  | 'invitation_sent'
  | 'activated'
  | 'access_disabled';

export function mapLegacyDigitalAccessStatus(
  status: LegacyDigitalAccessStatus,
): DigitalAccessStatus {
  switch (status) {
    case 'not_invited':
      return 'not_activated';
    case 'invitation_sent':
      return 'app_link_sent';
    default:
      return status;
  }
}
