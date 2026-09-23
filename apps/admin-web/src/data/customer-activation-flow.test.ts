import { describe, expect, it } from 'vitest';
import {
  deriveCustomerBusinessStatus,
  deriveDigitalAccessStatus,
} from './customer-digital-access';

describe('customer activation flow contracts', () => {
  it('salesman-created LEAD shop is business-active without app login', () => {
    expect(
      deriveCustomerBusinessStatus({
        isActive: true,
        lifecycleStatus: 'LEAD',
      }),
    ).toBe('active');
    expect(
      deriveDigitalAccessStatus({
        isActive: true,
        hasAuthLink: false,
        hasAppLinkSent: false,
      }),
    ).toBe('not_activated');
  });

  it('sharing app link does not activate the customer', () => {
    expect(
      deriveDigitalAccessStatus({
        isActive: true,
        hasAuthLink: false,
        hasAppLinkSent: true,
      }),
    ).toBe('app_link_sent');
    expect(
      deriveDigitalAccessStatus({
        isActive: true,
        hasAuthLink: true,
        hasAppLinkSent: true,
      }),
    ).toBe('activated');
  });

  it('first OTP login marks digital access activated via auth link', () => {
    expect(
      deriveDigitalAccessStatus({
        isActive: true,
        hasAuthLink: true,
        hasAppLinkSent: false,
      }),
    ).toBe('activated');
  });

  it('inactive business disables app access label', () => {
    expect(
      deriveDigitalAccessStatus({
        isActive: false,
        hasAuthLink: true,
        hasAppLinkSent: false,
      }),
    ).toBe('access_disabled');
  });
});
