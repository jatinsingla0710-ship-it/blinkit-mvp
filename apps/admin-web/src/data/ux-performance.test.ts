import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AI_READONLY_STALE_MS,
  SCAN_IMAGE_CAPTURE,
  scanImageInputAttrs,
} from './ux-performance';

const shellSource = readFileSync(
  resolve(__dirname, '../layout/AdminShell.tsx'),
  'utf8',
);
const globalCss = readFileSync(
  resolve(__dirname, '../styles/global.css'),
  'utf8',
);
const billScanSource = readFileSync(
  resolve(__dirname, '../pages/purchases/BillScanUploadPage.tsx'),
  'utf8',
);

describe('Phase 25 UX / accessibility / performance', () => {
  it('exposes mobile rear-camera capture attrs for scan uploads', () => {
    const attrs = scanImageInputAttrs();
    expect(attrs.accept).toContain('image/jpeg');
    expect(attrs.capture).toBe(SCAN_IMAGE_CAPTURE);
    expect(AI_READONLY_STALE_MS).toBeGreaterThanOrEqual(60_000);
  });

  it('wires a skip link and main landmark id in AdminShell', () => {
    expect(shellSource).toContain('ga-skip-link');
    expect(shellSource).toContain('href="#ga-main"');
    expect(shellSource).toContain('id="ga-main"');
  });

  it('defines focus-visible and reduced-motion helpers in global CSS', () => {
    expect(globalCss).toMatch(/:focus-visible/);
    expect(globalCss).toMatch(/prefers-reduced-motion/);
  });

  it('uses shared scan capture attrs on bill photo upload', () => {
    expect(billScanSource).toContain('scanImageInputAttrs');
  });
});
