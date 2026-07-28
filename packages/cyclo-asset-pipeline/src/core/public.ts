import * as cc from 'cc';

import type { AbortSignal } from '@cyclonium/abort-controller';

import type { AssetScope } from './asset-scope.js';

export import CycloAsset = cc.Asset;

export type AssetId = string;

export interface AssetType<TAsset extends CycloAsset> {
  readonly prototype: TAsset;
}

export enum LoadHandleState {
  loading = 'loading',
  ready = 'ready',
  failed = 'failed',
  cancelled = 'cancelled',
  released = 'released',
}

export interface AssetHandle<
  TAsset extends CycloAsset = CycloAsset,
> {
  readonly id: AssetId;
  readonly state: LoadHandleState;
  readonly ready: Promise<TAsset>;
  readonly value: TAsset | undefined;

  release(): void;
}

export enum AssetMergeMode {
  useFirst = 'use-first',
  union = 'union',
  intersection = 'intersection',
}

export interface AssetCollectionHandle<
  TAsset extends CycloAsset = CycloAsset,
> {
  readonly keys: readonly AssetId[];
  readonly state: LoadHandleState;
  readonly ready: Promise<readonly TAsset[]>;
  readonly values: readonly TAsset[] | undefined;

  release(): void;
}

export interface AssetLoadOptions {
  readonly signal?: AbortSignal;
  readonly scope?: AssetScope;
}

export interface RemoteAssetLoadOptions extends AssetLoadOptions {
  readonly format?: string;
}

export enum AssetIntegrityPolicy {
  /** Every Artifact must declare and pass SHA-256 verification. */
  required = 'required',
  /** Declared hashes are enforced; Artifacts without hashes are accepted. */
  whenPresent = 'when-present',
  /** Verification failures are reported but do not stop Decode. */
  diagnostics = 'diagnostics',
  /** Hash metadata is ignored and SHA-256 is not computed. */
  disabled = 'disabled',
}

export class AssetIntegrityError extends Error {
  constructor(
    message: string,
    details: {
      readonly actualHash?: string;
      readonly byteSize?: number;
      readonly expectedHash?: string;
      readonly location: string;
      readonly sourceId: string;
    },
    options?: ConstructorParameters<typeof Error>[1],
  ) {
    super(message, options);
    this.name = 'AssetIntegrityError';
    this.actualHash = details.actualHash;
    this.byteSize = details.byteSize;
    this.expectedHash = details.expectedHash;
    this.location = details.location;
    this.sourceId = details.sourceId;
  }

  readonly actualHash: string | undefined;
  readonly byteSize: number | undefined;
  readonly expectedHash: string | undefined;
  readonly location: string;
  readonly sourceId: string;
}

export interface AssetPipelineInstallOptions {
  readonly artifactCacheByteBudget?: number;
  /** Defaults to AssetIntegrityPolicy.whenPresent. */
  readonly integrityPolicy?: AssetIntegrityPolicy;
  /** Required when integrityPolicy is AssetIntegrityPolicy.diagnostics. */
  readonly onIntegrityDiagnostic?: (
    error: AssetIntegrityError,
  ) => void;
}

export enum AssetPipelineInstallStage {
  settings = 'settings',
  acquire = 'acquire',
  integrity = 'integrity',
  parse = 'parse',
}

export class AssetPipelineInstallError extends Error {
  constructor(
    stage: AssetPipelineInstallStage,
    message: string,
    options?: ConstructorParameters<typeof Error>[1],
  ) {
    super(message, options);
    this.name = 'AssetPipelineInstallError';
    this.stage = stage;
  }

  readonly stage: AssetPipelineInstallStage;
}

export enum AssetLoadStage {
  resolve = 'resolve',
  acquire = 'acquire',
  decode = 'decode',
  link = 'link',
  finalize = 'finalize',
  publish = 'publish',
}

export class AssetLoadError extends Error {
  constructor(
    assetId: AssetId,
    stage: AssetLoadStage,
    message: string,
    options?: ConstructorParameters<typeof Error>[1],
  ) {
    super(message, options);
    this.name = 'AssetLoadError';
    this.assetId = assetId;
    this.stage = stage;
  }

  readonly assetId: AssetId;
  readonly stage: AssetLoadStage;
}

export class AssetLoadCancelledError extends Error {
  constructor(
    assetId: AssetId,
    options?: ConstructorParameters<typeof Error>[1],
  ) {
    super(`Loading asset "${assetId}" was cancelled.`, options);
    this.name = 'AbortError';
    this.assetId = assetId;
  }

  readonly assetId: AssetId;
}
