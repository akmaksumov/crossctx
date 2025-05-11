import type {
  IBroadcastableType,
  IObservable,
  ISignal,
  ISlot,
  ISubscribtion,
} from "./core.js";
import { uniqueId, assertIsNative } from "./util.js";

export class Signal<T> implements ISignal<T> {
  readonly name: string;
  readonly emitOnValueChanged: boolean;
  #latestValue: T | undefined = undefined;
  protected slots: Map<string, ISlot<T>> = new Map();
  protected inverseSlots: WeakMap<ISlot<T>, string> = new Map();

  constructor(params: { name: string; emitOnValueChanged?: boolean }) {
    this.name = params.name;
    this.emitOnValueChanged = params.emitOnValueChanged ?? false;
  }

  get latestValue(): T | undefined {
    return this.#latestValue;
  }

  #delete(id: string): boolean {
    const slot = this.slots.get(id);
    if (slot != null) {
      this.inverseSlots.delete(slot);
    }
    return this.slots.delete(id);
  }

  #equal(value: T): boolean {
    return value === this.#latestValue;
  }

  emit(value: T): number | false {
    if (this.emitOnValueChanged && this.#equal(value)) return false;
    const prev = this.#latestValue;
    this.#latestValue = value;
    let count = 0;
    for (const [key, slot] of this.slots.entries()) {
      try {
        slot(value, prev);
      } finally {
        count++;
      }
    }
    return count;
  }

  subscribe(fn: ISlot<T>): ISubscribtion {
    const key = uniqueId();
    assertIsNative(fn, ["function"]);
    if (this.inverseSlots.has(fn)) {
      /* Make sure there is only one (key,fn) pair */
      this.#delete(this.inverseSlots.get(fn)!);
    }
    if (this.slots.has(key)) {
      /* Make sure there is only one (key,fn) pair */
      this.#delete(key);
    }
    this.slots.set(key, fn);
    this.inverseSlots.set(fn, key);
    return {
      unsubscribe: () => this.#delete(key),
    };
  }

  disconnect(input: string | ISlot<T>): boolean {
    let target: string | null = null;
    if (typeof input === "function") {
      target = this.inverseSlots.get(input) ?? null;
    } else {
      assertIsNative(input, "string");
      target = input;
    }
    if (target != null) return this.#delete(target);
    return false;
  }

  clear(): void {
    this.slots.clear();
    this.inverseSlots = new WeakMap();
  }
}

declare global {
  var broadcastChannels: Set<BroadcastChannel>;
}

// window.broadcastChannels = new Set<BroadcastChannel>();

export type BroadcastedValue<T = any> =
  | {
      type: "value";
      value: IBroadcastableType<T>;
    }
  | {
      type: "init";
      value: T;
    };

export class BroadcastedSignal<T> extends Signal<T> implements ISignal<T> {
  protected readonly channel: BroadcastChannel;
  readonly channelName: string;
  state: "online" | "disposed" = "online";
  constructor(params: { name: string; emitOnValueChanged?: boolean }) {
    super(params);
    this.channelName = `${new.target.name}${this.name}`;
    this.channel = new BroadcastChannel(this.channelName);
    window.broadcastChannels.add(this.channel);
    this.channel.onmessage = (event: MessageEvent<T>) => {
      /* Notify Local Listeners */
      super.emit(event.data);
    };
  }

  override emit(value: T): number | false {
    if (this.state === "disposed") {
      throw new Error(`Signal with name=${this.name} has been disposed`);
    }
    /* Notify Local Listeners */
    const result = super.emit(value);
    if (result !== false) {
      /* Notify 'Cross Document' Listeners */
      this.channel.postMessage(value);
    }
    return result;
  }

  dispose() {
    window.broadcastChannels.delete(this.channel);
    this.channel.close();
    this.clear();
    this.state = "disposed";
  }
}
