import { ManagedEventEmitter } from '@cyclonium/event';

export enum ContactEventListenerFlagIndex {
  begin = 0,
  stay = 1,
  end = 2,
  body = 8,
}

class ManagedCollisionEventEmitter<T extends unknown[]> extends ManagedEventEmitter<T> {
  constructor(
    private _callback: (hasAnyListener: boolean) => void,
  ) {
    super();
  }

  override emit(...args: Parameters<ManagedEventEmitter<T>['emit']>) {
    const r = super.emit(...args);
    this._updateListenerFlag();
    return r;
  }

  override add(...args: Parameters<ManagedEventEmitter<T>['add']>) {
    const r = super.add(...args);
    this._updateListenerFlag();
    return r;
  }

  override remove(...args: Parameters<ManagedEventEmitter<T>['remove']>) {
    const r = super.remove(...args);
    this._updateListenerFlag();
    return r;
  }

  override removeAll() {
    const r = super.removeAll();
    this._updateListenerFlag();
    return r;
  }

  private _updateListenerFlag() {
    this._callback(this.listenerCount > 0);
  }
}

export function createCollisionEventEmitter<T extends unknown[]>(callback: (hasAnyListener: boolean) => void) {
  return new ManagedCollisionEventEmitter<T>(callback) as ManagedEventEmitter<T>;
}
