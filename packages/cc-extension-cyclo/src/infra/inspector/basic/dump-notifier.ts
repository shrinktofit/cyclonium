import { inject, type InjectionKey, type Ref } from 'vue';
import type RawUIProp from './raw/raw-ui-prop.vue';
import type { BasicDump, Dump } from '../../../dump/dump.js';

export class DumpNotifier {
  constructor(private _uiPropRef: Ref<InstanceType<typeof RawUIProp>>) {
  }

  emitChange<T>(dump: BasicDump<T>, path: string) {
    this._submit('change-dump', dump, path);
  }

  emitConfirm<T>(dump: BasicDump<T>, path: string) {
    this._submit('confirm-dump', dump, path);
  }

  private _submit<T>(type: 'change-dump' | 'confirm-dump', dump: BasicDump<T>, path: string) {
    this._uiPropRef.value?.submit(type, dump, path);
  }
}

export const injectionKeyDumpNotifier: InjectionKey<DumpNotifier> = Symbol('DumpNotifier');

export function useDumpNotifier() {
  const dumpNotifier = inject(injectionKeyDumpNotifier);
  if (!dumpNotifier) {
    throw new Error('DumpNotifier is not provided.');
  }
  return dumpNotifier;
}
