import type { AbortSignal } from '@cyclonium/abort-controller';

export interface EventListenerOptions {
  signal?: AbortSignal;
  once?: boolean;
}
