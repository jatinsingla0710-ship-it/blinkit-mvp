import { describe, expect, it } from 'vitest';

import {
  buildDigitalAccessVm,
  deriveCustomerBusinessStatus,
  deriveDigitalAccessStatus,
} from '@/data/customer-digital-access';

describe('customer digital access', () => {
  it('treats LEAD shop as business-active when is_active', () => {
    expect(
      deriveCustomerBusinessStatus({
        isActive: true,
        lifecycleStatus: 'LEAD',
      }),
    ).toBe('active');
  });

  it('derives not_activated when no auth link or app link sent', () => {
    expect(
      deriveDigitalAccessStatus({
        isActive: true,
        hasAuthLink: false,
        hasAppLinkSent: false,
      }),
    ).toBe('not_activated');
  });

  it('derives activated when auth link exists', () => {
    const vm = buildDigitalAccessVm({
      isActive: true,
      hasAuthLink: true,
      hasAppLinkSent: false,
      primaryMobile: '+919999999999',
      activatedAtLabel: 'Today',
    });
    expect(vm.status).toBe('activated');
    expect(vm.label).toBe('Activated');
  });

  it('derives app_link_sent without marking activated', () => {
    const vm = buildDigitalAccessVm({
      isActive: true,
      hasAuthLink: false,
      hasAppLinkSent: true,
      primaryMobile: '+919999999999',
      appLinkSentAtLabel: 'Yesterday',
    });
    expect(vm.status).toBe('app_link_sent');
    expect(vm.label).toBe('App Link Sent');
    expect(vm.description).toMatch(/has not logged in/i);
  });

  it('KPI counts treat not_activated and app_link_sent separately', () => {
    const statuses = [
      deriveDigitalAccessStatus({
        isActive: true,
        hasAuthLink: false,
        hasAppLinkSent: true,
      }),
      deriveDigitalAccessStatus({
        isActive: true,
        hasAuthLink: false,
        hasAppLinkSent: false,
      }),
      deriveDigitalAccessStatus({
        isActive: true,
        hasAuthLink: true,
        hasAppLinkSent: false,
      }),
    ];
    const notActivated = statuses.filter((s) => s === 'not_activated').length;
    const appLinkSent = statuses.filter((s) => s === 'app_link_sent').length;
    expect(notActivated).toBe(1);
    expect(appLinkSent).toBe(1);
  });
});
