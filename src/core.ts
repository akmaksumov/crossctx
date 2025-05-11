export type KeysOf<T extends Record<PropertyKey, any>> = Extract<keyof T, string>;
type ReadonlyUnion<T extends Record<PropertyKey, unknown>> = {
  [TT in T as number]: Readonly<TT>;
}[number];

export interface IObserver<T = any> {
  (value: T): void;
}

export interface IObservable<T = any> {
  subscribe(fn: IObserver<T>): ISubscribtion;
}

export interface ISubscribtion {
  unsubscribe: () => void;
}

export interface ISlot<T> {
  (next: T, prev: T | undefined): void;
}

export interface ISignal<T> extends IObservable<T> {
  readonly name: string;
  readonly latestValue: T | undefined;
  /**
   * `emit` only if value has changed, i.e. `prev !== next`.
   */
  readonly emitOnValueChanged: boolean;
  /**
   *
   * @param value the value to assign as next `latestValue`
   * @returns `false` if `emitOnValueChanged === true` and `latestValue === value`,
   * i.e. the 'ptev' is the same as 'next'. if `emitOnValueChanged === false`
   * returns the count of observers executed
   */
  emit(value: T): number | false;
  subscribe(fn: ISlot<T>): ISubscribtion;
  clear(): void;
}

export type BroadcastedEventTypes<ES extends IEventSchemaMap = IEventSchemaMap> = {
  [K in KeysOf<ES>]: ES[K] extends IBroadcastedEventSchema ? K : never;
}[KeysOf<ES>];

export type LocalEventTypes<ES extends IEventSchemaMap = IEventSchemaMap> = Exclude<
  KeysOf<ES>,
  BroadcastedEventTypes<ES>
>;

export type ExcludeBroadcastedEventTypes<ES extends IEventSchemaMap = IEventSchemaMap> =
  Exclude<KeysOf<ES>, BroadcastedEventTypes<ES>>;

export interface IEventSchemaBase {
  payload: unknown;
  broadcasted?: boolean;
}

export interface IBroadcastedEventSchema extends IEventSchemaBase {
  payload: unknown;
  broadcasted: true;
}

export interface ILocalEventSchema extends IEventSchemaBase {
  payload: unknown;
  broadcasted?: false;
}

export type IEventSchema = ILocalEventSchema | IBroadcastedEventSchema;

export interface IEventSchemaMap {
  [type: string]: IEventSchema;
}

export type IEventMap<ES extends IEventSchemaMap = IEventSchemaMap> = {
  [K in KeysOf<ES>]: IDispatchedEvent<ES, K>;
};

export type IEventValue<ES extends IEventSchemaMap = IEventSchemaMap> =
  IEventMap<ES>[KeysOf<ES>];

export type IBroadcastedEvents<ES extends IEventSchemaMap = IEventSchemaMap> = Extract<
  IEventValue<ES>,
  IBroadcastedEvent
>;

export interface IBaseEvent<K extends string = string, V = unknown> {
  readonly id: string;
  readonly type: K;
  readonly payload: Readonly<V>;
  readonly broadcast?: boolean;
  readonly isRemoteSubject?: boolean;
  readonly createdTime: Date;
}

export interface ILocalEventParams<K extends string = string, V = unknown> {
  readonly payload: Readonly<V>;
  readonly isRemoteSubject?: false;
}

export interface ILocalEvent<K extends string = string, V = unknown>
  extends IBaseEvent<K, V> {
  readonly broadcast?: false;
  readonly isRemoteSubject?: false;
}

export interface IBroadcastedEventParams<K extends string = string, V = unknown> {
  readonly payload: Readonly<V>;
  readonly isRemoteSubject: boolean;
}

export interface IBroadcastedEvent<K extends string = string, V = unknown>
  extends IBaseEvent<K, V> {
  readonly broadcast: true;
  readonly isRemoteSubject: boolean;
}

export type IEvent<K extends string = string, V extends unknown = unknown> =
  | ILocalEvent<K, V>
  | IBroadcastedEvent<K, V>;

export type IExtractEvent<EU extends IEvent, K extends EU["type"]> = EU extends IEvent<K>
  ? EU
  : never;

export interface IEventHandlerMethod<
  ES extends IEventSchemaMap = IEventSchemaMap,
  K extends KeysOf<ES> = KeysOf<ES>
> {
  (event: IDispatchedEvent<ES, K>): void;
}

export interface IEventHandler<
  ES extends IEventSchemaMap = IEventSchemaMap,
  K extends KeysOf<ES> = KeysOf<ES>
> {
  id: string;
  type: K[];
  runOnce: boolean;
  handleEvent: IEventHandlerMethod<ES, K>;
}

export type IEventPayload<S extends IEventSchema> = S["payload"];

export type IDispatchedParams<
  ES extends IEventSchemaMap = IEventSchemaMap,
  K extends KeysOf<ES> = KeysOf<ES>
> = {
  [KK in K]: {
    payload: ES[KK]["payload"];
    timeout?: number;
  };
}[K];

export type ICreateEventParameters<
  ES extends IEventSchemaMap = IEventSchemaMap,
  K extends KeysOf<ES> = KeysOf<ES>
> = {
  [KK in K]: ES[KK] extends IBroadcastedEventSchema
    ? IBroadcastedEventParams<KK, ES[KK]["payload"]>
    : ILocalEventParams<KK, ES[KK]["payload"]>;
}[K];

export type ComputeDispatched<
  K extends string = string,
  S extends IEventSchema = IEventSchema
> = S extends IBroadcastedEventSchema
  ? IBroadcastedEvent<K, S["payload"]>
  : ILocalEvent<K, S["payload"]>;

export type IDispatchedEvent<
  ES extends IEventSchemaMap = IEventSchemaMap,
  K extends KeysOf<ES> = KeysOf<ES>
> = {
  [KK in K]: ComputeDispatched<KK, ES[KK]>;
}[K];

export type IEventSchemaConstraints<ES extends IEventSchemaMap = IEventSchemaMap> = {
  [K in KeysOf<ES>]: ES[K] extends IBroadcastedEventSchema
    ? Omit<ES[K], "payload">
    : Omit<ES[K] & ILocalEventSchema, "payload">;
};

export interface IDispatchEventMethod<ES extends IEventSchemaMap = IEventSchemaMap> {
  <K extends LocalEventTypes<ES>>(type: K, params: IDispatchedParams<ES, K>): void;
}

export interface IBroadcastEventMethod<ES extends IEventSchemaMap = IEventSchemaMap> {
  <K extends BroadcastedEventTypes<ES>>(type: K, params: IDispatchedParams<ES, K>): void;
}

export interface IEventHandlerParam<ES extends IEventSchemaMap, K extends KeysOf<ES>> {
  runOnce?: boolean;
  handleEvent: IEventHandlerMethod<ES, K>;
}

export namespace Method {
  export interface DispatchedEventGuard<
    ES extends IEventSchemaMap = IEventSchemaMap,
    K extends KeysOf<ES> = KeysOf<ES>
  > {
    (event: IDispatchedEvent<ES, K>): boolean;
  }

  export interface Subscribe<ES extends IEventSchemaMap = IEventSchemaMap> {
    <K extends KeysOf<ES>>(
      ...params: [...type: K[], handler: IEventHandlerParam<ES, K>]
    ): ISubscribtion;
    <K extends KeysOf<ES>>(type: K[], handler: IEventHandlerParam<ES, K>): ISubscribtion;
  }

  export interface BroadcastEvent<
    ES extends IEventSchemaMap,
    This extends IBroadcaster<ES>
  > {
    <K extends BroadcastedEventTypes<ES>>(
      this: This,
      type: K,
      params: IDispatchedParams<ES, K>
    ): This;
  }

  export interface DispatchEvent<
    ES extends IEventSchemaMap,
    This extends IDispatcher<ES>
  > {
    <K extends ExcludeBroadcastedEventTypes<ES>>(
      this: This,
      type: K,
      params: IDispatchedParams<ES, K>
    ): This;
  }
}

export interface ISubscribeable<ES extends IEventSchemaMap = IEventSchemaMap> {
  subscribe: Method.Subscribe<ES>;
}

export interface IBroadcaster<ES extends IEventSchemaMap = IEventSchemaMap> {
  broadcast: Method.BroadcastEvent<ES, this>;
}

export interface IDispatcher<ES extends IEventSchemaMap = IEventSchemaMap> {
  dispatch: Method.DispatchEvent<ES, this>;
}

export interface IEventScheduler<ES extends IEventSchemaMap>
  extends ISubscribeable<ES>,
    IDispatcher<ES>,
    IBroadcaster<ES> {
  has<T extends string>(type: T): type is T & KeysOf<ES>;
}
export interface IEventDispatcher<ES extends IEventSchemaMap = IEventSchemaMap>
  extends ISubscribeable<ES> {
  readonly constraints: IEventSchemaConstraints<ES>;
  // #register?: <E extends EU>(constraints: Partial<IEventConstraints<E>>) => void;
  clear(): void;
  // isConstrained(): this is this & IConstrainedEventDispatcher<EU>;
  has<T extends string>(type: T): type is T & KeysOf<ES>;
  broadcastEnabled(): this is this & IEventBroadcaster<ES>;
  dispatch: IDispatchEventMethod<ES>;
  broadcast?: IBroadcastEventMethod<ES>;
}

export interface IEventBroadcaster<ES extends IEventSchemaMap = IEventSchemaMap>
  extends IEventDispatcher<ES> {
  readonly channelName: string;
  broadcast: IBroadcastEventMethod<ES>;
}

// export type IConstrainedEventMap<>
export type IEventTypes<EM extends IEventMap = IEventMap> = KeysOf<EM>;
export interface ISubjectConstructor<S extends ISubject> {
  new (): S;
  readonly name: string;
}

export interface ISubject<ES extends IEventSchemaMap = IEventSchemaMap> {
  /**
   * Must be the same for all instances per class
   */
  readonly metaName: string;
  subscribe<K extends KeysOf<ES>>(
    type: K | K[],
    handler: {
      runOnce?: boolean;
      handleEvent: IEventHandlerMethod<ES, K>;
    }
  ): ISubscribtion;
}

export interface IBroadcastedSubject<ES extends IEventSchemaMap = IEventSchemaMap>
  extends ISubject<ES> {
  /**
   * Must be unique for all instances per class. An instance with the same name, is
   * considered the same no matter what browsing context your in
   */
  readonly uniqueName: string;
}

export type IBroadcastableType<T = any> = Exclude<T, Function | Node>;

export namespace TestEvents {
  export interface Event {}
  export type InferSetT<SET extends Set<string>> = SET extends Set<infer T> ? T : never;
  export type ICreateEvent = {
    type: "create";
    payload: {
      message: "hello i was created";
    };
  };

  export type IRemovedEvent = {
    type: "removed";
    payload: {
      message: "bye i was removed ;(";
    };
  };

  export type EventMap = {
    create: ICreateEvent;
    removed: IRemovedEvent;
  };
}
