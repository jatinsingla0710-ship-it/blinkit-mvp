import { describe, expect, it } from 'vitest';
import { appRefreshPlan, shouldPromptForAppRefresh } from './app-update';

describe('app update prompt', () => {
  it('stays quiet on the first install', () => {
    expect(shouldPromptForAppRefresh(false)).toBe(false);
  });

  it('asks for a manual refresh when a worker was already controlling the page', () => {
    expect(shouldPromptForAppRefresh(true)).toBe(true);
  });

  it('reloads only, unless a waiting worker still needs a tap to activate', () => {
    expect(appRefreshPlan(false)).toBe('reload');
    expect(appRefreshPlan(true)).toBe('activate-then-reload');
  });
});
