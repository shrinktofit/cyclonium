import { vi, expect, it } from 'vitest';

const configureStandalone = vi.hoisted(async () => {
  const { configure } = await import('@cyclonium/cc-test/runtime/configure');
  configure({
    HEADLESS: true,
    DEBUG: true,
    NET_MODE: 12,
  });
});
void configureStandalone;

import * as cc from 'cc';
import { DEBUG, HEADLESS, NET_MODE } from 'cc/env';

it('should apply hoisted standalone configure options before importing cc', async () => {
  expect(cc.VERSION).toBeTypeOf('string');
  expect(HEADLESS).toBe(true);
  expect(DEBUG).toBe(true);
  expect(NET_MODE).toBe(12);

  const configureModule = await import('@cyclonium/cc-test/runtime/configure');
  expect(Object.keys(configureModule)).toEqual([
    'configure',
  ]);
});
