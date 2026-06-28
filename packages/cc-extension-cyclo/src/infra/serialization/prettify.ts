interface PrettifyContext {
  refInfos: Array<{
    ref: { __id__: number };
    count: number;
  }>;
  objects: unknown[];
}

export function prettifySerialized(serialized: unknown) {
  if (!Array.isArray(serialized) || serialized.length === 0) {
    return serialized;
  }
  const refInfos = Array.from({ length: serialized.length }, (_, index) => {
    return {
      ref: { __id__: index },
      count: 0,
    };
  });
  const ctx = { refInfos: refInfos, objects: serialized };
  ++ctx.refInfos[0].count;
  countRefs(ctx, serialized);
  ctx.objects[0] = trimRefs(ctx, serialized[0]);
  for (let iRef = 0; iRef < ctx.refInfos.length;) {
    const ref = ctx.refInfos[iRef];
    if (ref.count === 0) {
      ctx.refInfos.splice(iRef, 1);
      ctx.objects.splice(iRef, 1);
    } else {
      ref.ref.__id__ = iRef;
      ++iRef;
    }
  }
  return ctx.objects;
}

function countRefs(ctx: PrettifyContext, value: unknown): void {
  if (Array.isArray(value)) {
    for (const v of value) {
      countRefs(ctx, v);
    }
  } else if (typeof value === 'object' && value) {
    if ('__id__' in value && typeof value.__id__ === 'number') {
      const id = value.__id__;
      ctx.refInfos[id].count++;
    } else {
      for (const v of Object.values(value)) {
        countRefs(ctx, v);
      }
    }
  }
}

function trimRefs(ctx: PrettifyContext, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => trimRefs(ctx, v));
  } else if (typeof value === 'object' && value) {
    if ('__id__' in value && typeof value.__id__ === 'number') {
      const id = value.__id__;
      const ref = ctx.refInfos[id];
      if (ref.count === 1) {
        ref.count = 0;
        return ctx.objects[ref.ref.__id__];
      } else {
        return ref.ref;
      }
    } else {
      const trimmed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        trimmed[k] = trimRefs(ctx, v);
      }
      return trimmed;
    }
  } else {
    return value;
  }
}
