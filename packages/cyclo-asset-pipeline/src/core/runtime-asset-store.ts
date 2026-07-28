import type {
  AssetResourceId,
} from './model.js';
import type { CycloAsset } from './public.js';

export enum RuntimeAssetState {
  constructing = 'constructing',
  ready = 'ready',
}

interface RuntimeAssetNode {
  readonly asset: CycloAsset;
  readonly cleanups: RuntimeAssetCleanup[];
  readonly dependencies: Set<AssetResourceId>;
  state: RuntimeAssetState;
}

interface RuntimeAssetCleanup {
  release(): void;
}

enum RuntimeAssetRootKind {
  cache = 'cache',
  consumer = 'consumer',
}

export class RuntimeAssetLease {
  constructor(releaseRoot: () => void) {
    this.#releaseRoot = releaseRoot;
  }

  get released(): boolean {
    return this.#released;
  }

  release(): void {
    if (this.#released) {
      return;
    }

    this.#released = true;
    this.#releaseRoot();
  }

  readonly #releaseRoot: () => void;
  #released = false;
}

export class RuntimeAssetStore {
  get size(): number {
    return this.#nodes.size;
  }

  define(
    resourceId: AssetResourceId,
    asset: CycloAsset,
  ): void {
    const existing = this.#nodes.get(resourceId);
    if (existing !== undefined) {
      if (existing.asset !== asset) {
        throw new Error(
          `Runtime asset "${resourceId}" has already been defined.`,
        );
      }
      return;
    }

    this.#nodes.set(resourceId, {
      asset,
      cleanups: [],
      dependencies: new Set(),
      state: RuntimeAssetState.constructing,
    });
  }

  setDependencies(
    resourceId: AssetResourceId,
    dependencies: Iterable<AssetResourceId>,
  ): void {
    const node = this.#requireNode(resourceId);
    node.dependencies.clear();
    for (const dependency of dependencies) {
      node.dependencies.add(dependency);
    }
  }

  addCleanup(
    resourceId: AssetResourceId,
    cleanup: RuntimeAssetCleanup,
  ): void {
    this.#requireNode(resourceId).cleanups.push(cleanup);
  }

  markReady(resourceId: AssetResourceId): void {
    this.#requireNode(resourceId).state = RuntimeAssetState.ready;
  }

  getReady<TAsset extends CycloAsset>(
    resourceId: AssetResourceId,
  ): TAsset | undefined {
    const node = this.#nodes.get(resourceId);
    if (node?.state !== RuntimeAssetState.ready) {
      return undefined;
    }

    return node.asset as TAsset;
  }

  getShell<TAsset extends CycloAsset>(
    resourceId: AssetResourceId,
  ): TAsset | undefined {
    return this.#nodes.get(resourceId)?.asset as TAsset | undefined;
  }

  retainConsumer(resourceId: AssetResourceId): RuntimeAssetLease {
    const node = this.#requireNode(resourceId);
    if (node.state !== RuntimeAssetState.ready) {
      throw new Error(
        `Runtime asset "${resourceId}" is not ready for a consumer.`,
      );
    }
    return this.#retainRoot(RuntimeAssetRootKind.consumer, resourceId);
  }

  retainCache(resourceId: AssetResourceId): RuntimeAssetLease {
    return this.#retainRoot(RuntimeAssetRootKind.cache, resourceId);
  }

  collect(): readonly AssetResourceId[] {
    const reachable = this.#findReachableNodes();
    const unreachable = Array.from(this.#nodes.entries())
      .filter(([resourceId]) => !reachable.has(resourceId));

    for (const [resourceId] of unreachable) {
      this.#nodes.delete(resourceId);
    }

    const ordered = orderForDestruction(new Map(unreachable));
    const destroyed: AssetResourceId[] = [];
    const errors: unknown[] = [];
    for (const [resourceId, node] of ordered) {
      try {
        node.asset.destroy();
      } catch (error) {
        errors.push(error);
      }
      for (const cleanup of node.cleanups) {
        try {
          cleanup.release();
        } catch (error) {
          errors.push(error);
        }
      }
      destroyed.push(resourceId);
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        'One or more unreachable runtime assets could not be destroyed.',
      );
    }

    return destroyed;
  }

  readonly #cacheRoots = new Map<AssetResourceId, number>();
  readonly #consumerRoots = new Map<AssetResourceId, number>();
  readonly #nodes = new Map<AssetResourceId, RuntimeAssetNode>();

  #findReachableNodes(): Set<AssetResourceId> {
    const reachable = new Set<AssetResourceId>();
    const pending = Array.from(this.#consumerRoots.keys())
      .concat(Array.from(this.#cacheRoots.keys()));

    while (pending.length > 0) {
      const resourceId = pending.pop();
      if (resourceId === undefined || reachable.has(resourceId)) {
        continue;
      }

      reachable.add(resourceId);
      const node = this.#nodes.get(resourceId);
      if (node !== undefined) {
        pending.push(...node.dependencies);
      }
    }

    return reachable;
  }

  #requireNode(resourceId: AssetResourceId): RuntimeAssetNode {
    const node = this.#nodes.get(resourceId);
    if (node === undefined) {
      throw new Error(`Runtime asset "${resourceId}" is not defined.`);
    }
    return node;
  }

  #retainRoot(
    kind: RuntimeAssetRootKind,
    resourceId: AssetResourceId,
  ): RuntimeAssetLease {
    const roots = kind === RuntimeAssetRootKind.consumer
      ? this.#consumerRoots
      : this.#cacheRoots;
    roots.set(resourceId, (roots.get(resourceId) ?? 0) + 1);

    return new RuntimeAssetLease(() => {
      const count = roots.get(resourceId);
      if (count === undefined) {
        throw new Error(
          `Runtime asset root "${resourceId}" was released too many times.`,
        );
      }

      if (count === 1) {
        roots.delete(resourceId);
      } else {
        roots.set(resourceId, count - 1);
      }

      this.collect();
    });
  }
}

function orderForDestruction(
  nodes: ReadonlyMap<AssetResourceId, RuntimeAssetNode>,
): ReadonlyArray<readonly [
  AssetResourceId,
  RuntimeAssetNode,
]> {
  let nextIndex = 0;
  const indices = new Map<AssetResourceId, number>();
  const lowLinks = new Map<AssetResourceId, number>();
  const stack: AssetResourceId[] = [];
  const onStack = new Set<AssetResourceId>();
  const components: AssetResourceId[][] = [];

  const visit = (resourceId: AssetResourceId): void => {
    indices.set(resourceId, nextIndex);
    lowLinks.set(resourceId, nextIndex);
    nextIndex += 1;
    stack.push(resourceId);
    onStack.add(resourceId);

    const node = nodes.get(resourceId);
    if (node === undefined) {
      throw new Error(`Runtime asset "${resourceId}" is not defined.`);
    }
    for (const dependency of node.dependencies) {
      if (!nodes.has(dependency)) {
        continue;
      }
      if (!indices.has(dependency)) {
        visit(dependency);
        lowLinks.set(
          resourceId,
          Math.min(
            requireGraphNumber(lowLinks, resourceId),
            requireGraphNumber(lowLinks, dependency),
          ),
        );
      } else if (onStack.has(dependency)) {
        lowLinks.set(
          resourceId,
          Math.min(
            requireGraphNumber(lowLinks, resourceId),
            requireGraphNumber(indices, dependency),
          ),
        );
      }
    }

    if (
      requireGraphNumber(lowLinks, resourceId)
      !== requireGraphNumber(indices, resourceId)
    ) {
      return;
    }

    const component: AssetResourceId[] = [];
    while (stack.length > 0) {
      const member = stack.pop();
      if (member === undefined) {
        break;
      }
      onStack.delete(member);
      component.push(member);
      if (member === resourceId) {
        break;
      }
    }
    components.push(component);
  };

  for (const resourceId of nodes.keys()) {
    if (!indices.has(resourceId)) {
      visit(resourceId);
    }
  }

  return components
    .reverse()
    .flatMap((component) => component
      .sort((left, right) => left.localeCompare(right))
      .map((resourceId) => {
        const node = nodes.get(resourceId);
        if (node === undefined) {
          throw new Error(`Runtime asset "${resourceId}" is not defined.`);
        }
        return [resourceId, node] as const;
      }));
}

function requireGraphNumber(
  values: ReadonlyMap<AssetResourceId, number>,
  resourceId: AssetResourceId,
): number {
  const value = values.get(resourceId);
  if (value === undefined) {
    throw new Error(`Runtime graph index for "${resourceId}" does not exist.`);
  }
  return value;
}
