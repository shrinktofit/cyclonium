import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  createWebAssetPlatformService,
} from '@/platform/web/platform.js';
import { sha256 } from '@/sha256/index.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SHA-256 platform implementations', () => {
  it('produces standard SHA-256 vectors through the portable fallback', async () => {
    /// @case
    /// The portable implementation hashes empty, UTF-8, and arbitrary binary
    /// byte sequences used by mini-game Artifact verification.
    /// @expect
    /// Every digest matches the published SHA-256 value and contains 32 bytes.
    const vectors = [
      {
        bytes: new Uint8Array(),
        expected:
          'e3b0c44298fc1c149afbf4c8996fb924'
          + '27ae41e4649b934ca495991b7852b855',
      },
      {
        bytes: new TextEncoder().encode('abc'),
        expected:
          'ba7816bf8f01cfea414140de5dae2223'
          + 'b00361a396177a9cb410ff61f20015ad',
      },
      {
        bytes: Uint8Array.from({ length: 256 }, (_, index) => index),
        expected:
          '40aff2e9d2d8922e47afd4648e696749'
          + '7158785fbd1da870e7110266bf944880',
      },
    ];

    for (const vector of vectors) {
      const digest = await sha256(vector.bytes);

      expect(digest).toHaveLength(32);
      expect(toHex(digest)).toBe(vector.expected);
    }
  });

  it('uses native Web Crypto for the Web platform', async () => {
    /// @case
    /// The Web platform hashes Artifact bytes while SubtleCrypto is present.
    /// @expect
    /// It requests SHA-256 from the native digest API and returns its bytes
    /// without invoking the portable implementation.
    const expected = Uint8Array.from({ length: 32 }, (_, index) => index);
    const digest = vi.fn((_algorithm: unknown, _data: unknown) => (
      Promise.resolve(expected.slice().buffer)
    ));
    vi.stubGlobal('crypto', {
      subtle: {
        digest,
      },
    });
    const bytes = new Uint8Array([1, 2, 3]);

    const actual = await createWebAssetPlatformService().sha256(bytes);

    expect(actual).toEqual(expected);
    expect(digest).toHaveBeenCalledTimes(1);
    expect(digest.mock.calls[0]?.[0]).toBe('SHA-256');
    expect(new Uint8Array(digest.mock.calls[0]?.[1] as ArrayBuffer)).toEqual(
      bytes,
    );
  });

  it('does not silently install a portable fallback on Web', async () => {
    /// @case
    /// A Web-like host does not expose SubtleCrypto.
    /// @expect
    /// Hashing fails with an explicit platform capability error instead of
    /// importing or running the mini-game fallback.
    vi.stubGlobal('crypto', {});

    await expect(
      createWebAssetPlatformService().sha256(new Uint8Array([1])),
    ).rejects.toThrow('Web Crypto SHA-256 is unavailable');
  });
});

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => (
    value.toString(16).padStart(2, '0')
  )).join('');
}
