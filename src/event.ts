import type {
  IBroadcastedEvent,
  BroadcastedEventTypes,
  IEventBroadcaster,
  IDispatchedEvent,
  IDispatchedParams,
  IEvent,
  IBaseEvent,
  IEventSchemaConstraints,
  IEventDispatcher,
  IEventHandler,
  IEventHandlerMethod,
  IEventPayload,
  ILocalEvent,
  LocalEventTypes,
  ISubject,
  ISubscribtion,
  IEventSchemaMap,
  KeysOf,
  ComputeDispatched,
  IBroadcastedEventSchema,
  ICreateEventParameters,
  IBroadcastedEvents,
  IBroadcastEventMethod,
  ISubscribeable,
  IEventHandlerParam,
} from "./core.js";
import { uniqueId } from "./util.js";
import { isIterable, KeyError } from "typeslib";

export type IEventTypeMap<EU extends IBaseEvent = IBaseEvent> = {
  [K in EU["type"]]: K;
};

export type IEventHandlerQueue<
  ES extends IEventSchemaMap = IEventSchemaMap,
  K extends KeysOf<ES> = KeysOf<ES>
> = Map<string, IEventHandler<ES, K>>;

export type IEventHandlerMap<ES extends IEventSchemaMap = IEventSchemaMap> = {
  [K in KeysOf<ES>]: IEventHandlerQueue<ES, K>;
};

export type EventBroadcaster<ES extends IEventSchemaMap = IEventSchemaMap> =
  EventDispatcher<ES> & {
    readonly channel: BroadcastChannel;
    readonly channelName: string;
    broadcast: IBroadcastEventMethod<ES>;
  };

export class EventHandlersMap<ES extends IEventSchemaMap> {
  protected readonly handlerMap!: IEventHandlerMap<ES>;
  constructor(handlerMap?: IEventHandlerMap<ES>) {
    if (handlerMap == null) {
      handlerMap = {} as IEventHandlerMap<ES>;
    }
    this.handlerMap = handlerMap;
  }

  protected get<T extends KeysOf<ES>>(type: T): IEventHandlerQueue<ES, T> {
    if (this.has(type)) {
      return this.handlerMap[type];
    } else {
      throw new KeyError(
        `No event of type=${type} is registered for this event dispatcher`
      );
    }
  }

  has<T extends string>(type: T): type is T & KeysOf<ES> {
    return this.#has(type);
  }

  clear(): void {
    for (const type of this.types()) {
      this.handlerMap[type].clear();
    }
  }

  #has(type: string): boolean {
    if (type in this.handlerMap && this.handlerMap[type as any] instanceof Map) {
      return true;
    }
    return false;
  }

  ensureHas(types: KeysOf<ES> | KeysOf<ES>[]): this {
    if (typeof types === "string") types = [types];
    for (const type of types) {
      if (!this.#has(type)) {
        this.handlerMap[type] = new Map();
      }
    }
    return this;
  }

  subscribe<K extends KeysOf<ES>>(handler: IEventHandler<ES, K>) {
    for (const type of handler.type) {
      this.get(type).set(handler.id, handler);
    }
  }
  /**
   * Handler can belong to multiple types, but must be registered
   * under same `id`
   */
  unsubscribeFrom<T extends KeysOf<ES>>(type: T, input: IEventHandler<ES, T> | string) {
    const id = typeof input === "string" ? input : input.id;
    this.get(type).delete(id);
  }

  unsubscribe<K extends KeysOf<ES>>(input: IEventHandler<ES, K> | string) {
    const id = typeof input === "string" ? input : input.id;
    const types = typeof input === "string" ? this.types() : input.type;
    for (const type of types) {
      this.handlerMap[type].delete(id);
    }
  }

  *entries<T extends KeysOf<ES>>(type: T): Iterable<[string, IEventHandler<ES, T>]> {
    for (const [key, handler] of this.get(type).entries()) {
      yield [key, handler];
    }
  }

  *types(): Iterable<KeysOf<ES>> {
    for (const key in this.handlerMap) {
      yield key as KeysOf<ES>;
    }
  }
}

export abstract class SubscribeableAbstract<ES extends IEventSchemaMap = IEventSchemaMap>
  implements ISubscribeable<ES>
{
  protected abstract subscribeRest<const K extends KeysOf<ES>>(
    types: K[],
    handler: IEventHandlerParam<ES, K>
  ): ISubscribtion;

  abstract has<const K extends string>(type: K): type is K & KeysOf<ES>;

  subscribe<const K extends KeysOf<ES>>(
    ...params: [...type: K[] | K[][], handler: IEventHandlerParam<ES, K>]
  ): ISubscribtion {
    const [types, handler] = this.parseSubscribed(...params);
    console.log(`inside of SubscribeableAbstract, types=${types}, handler:${handler}`);
    return this.subscribeRest(types, handler);
  }

  protected parseSubscribed<const K extends KeysOf<ES>>(
    ...params: [...type: K[] | K[][], handler: IEventHandlerParam<ES, K>]
  ): [types: K[], handler: IEventHandlerParam<ES, K>] {
    const cache: Record<"isTwoParams" | "isSpreadParams", boolean | undefined> = {
      isTwoParams: undefined,
      isSpreadParams: undefined,
    };
    const thisRef = this;
    function isTwoParams(
      innerParams: [...type: K[] | K[][], handler: IEventHandlerParam<ES, K>]
    ): innerParams is [K[], handler: IEventHandlerParam<ES, K>] {
      if (cache.isTwoParams != null) return cache.isTwoParams;
      if (innerParams.length === 2 && Array.isArray(innerParams[0])) {
        const [keys, handler] = innerParams;
        // const handler = innerParams[1];
        if (
          typeof handler === "object" &&
          "handleEvent" in handler &&
          typeof handler.handleEvent === "function"
        ) {
          for (let i = 0; i < keys.length; i++) {
            const type = keys[i];
            if (typeof type !== "string") return (cache.isTwoParams = false);
            if (!thisRef.has(type)) return (cache.isTwoParams = false);
          }
          return (cache.isTwoParams = true);
        }
      }
      return (cache.isTwoParams = false);
    }

    function isSpreadParams(
      innerParams: [...type: K[] | K[][], handler: IEventHandlerParam<ES, K>]
    ): innerParams is [...type: K[], handler: IEventHandlerParam<ES, K>] {
      if (cache.isSpreadParams != null) return cache.isSpreadParams;
      if (isTwoParams(innerParams)) return (cache.isSpreadParams = false);
      if (innerParams.length > 1) {
        const handler = innerParams.at(-1);
        if (
          typeof handler === "object" &&
          "handleEvent" in handler &&
          typeof handler.handleEvent === "function"
        ) {
          for (let i = 0; i < innerParams.length - 1; i++) {
            const type = innerParams[i];
            if (typeof type !== "string") return (cache.isSpreadParams = false);
            if (!thisRef.has(type)) return (cache.isSpreadParams = false);
          }
          return (cache.isSpreadParams = true);
        }
      }
      return (cache.isSpreadParams = false);
    }

    if (isTwoParams(params)) {
      return params;
    } else if (isSpreadParams(params)) {
      const handler = params.at(-1) as IEventHandlerParam<ES, K>;
      const types = params.splice(0, params.length - 1) as K[];
      return [types, handler];
    } else {
      throw new TypeError();
    }
  }
}

export class EventDispatcher<ES extends IEventSchemaMap = IEventSchemaMap>
  extends SubscribeableAbstract<ES>
  implements IEventDispatcher<ES>
{
  /**
   * If you need to constrain events to certain types, pass `eventTypes`
   * to the constructor of this class. otherwise type of events are dynamic
   * and will be created on the fly
   */
  readonly constraints: IEventSchemaConstraints<ES>;
  protected readonly channel?: BroadcastChannel;
  protected readonly handlers!: EventHandlersMap<ES>;
  constructor(
    params:
      | {
          constraints: IEventSchemaConstraints<ES>;
          broadcastEnabled?: false;
        }
      | {
          constraints: IEventSchemaConstraints<ES>;
          broadcastEnabled: true;
          channelName: string;
        }
  ) {
    super();
    this.handlers = new EventHandlersMap();
    this.constraints = params.constraints;
    if (params.broadcastEnabled === true) {
      this.channel = new BroadcastChannel(params.channelName);
      this.channel.onmessage = (event: MessageEvent<IBroadcastedEvents<ES>>) => {
        const { data } = event;
        this.#dispatch(data);
      };
    }
  }

  // static constrained<EU extends IEvent>(params: {
  //   constraints: IEventSchemaConstraints<EU>;
  // }): EventDispatcher<EU> & IConstrainedEventDispatcher<EU> {
  //   return new this(params) as any;
  // }

  get channelName(): string | undefined {
    return this.channel?.name;
  }

  broadcastEnabled(): this is this & EventBroadcaster<ES> {
    return this.channel != null;
  }

  protected hasSubscribers(type: KeysOf<ES>): boolean {
    return this.handlers.has(type);
  }

  isBroadcastedEvent<K extends KeysOf<ES>>(
    type: K
  ): type is K & BroadcastedEventTypes<ES> {
    if (this.constraints[type].broadcasted === true) {
      return true;
    }
    return false;
  }

  createEvent<const K extends KeysOf<ES>>(
    type: K,
    params: ICreateEventParameters<ES, K>
  ): IDispatchedEvent<ES, K> {
    const id = uniqueId();
    const createdTime = new Date(Date.now());
    const result: IBaseEvent<K, ES[K]["payload"]> = {
      ...params,
      createdTime,
      type,
      id,
    } as const;
    if (this.isBroadcastedEvent(type)) {
      return { ...result, broadcast: true } as IDispatchedEvent<ES, K>;
    } else {
      return { ...result, broadcast: false } as IDispatchedEvent<ES, K>;
    }
  }

  protected subscribeRest<K extends KeysOf<ES>>(
    types: K[],
    handler: {
      runOnce?: boolean;
      handleEvent: IEventHandlerMethod<ES, K>;
    }
  ): ISubscribtion {
    // make sure unique
    const runOnce: boolean = handler.runOnce ?? false;
    const handlerObject: IEventHandler<ES, K> = {
      ...handler,
      id: uniqueId(),
      type: types,
      runOnce,
    };
    this.handlers.ensureHas(types);
    this.handlers.subscribe(handlerObject);

    return {
      unsubscribe: () => this.handlers.unsubscribe(handlerObject),
    };
  }
  /**
   * Whether or not this instance impliments an event of type=`type`.
   *
   * If `eventTypes` was passed in to the constructor, than implimented types
   * are determined by the values of that set, otherwise this method always returns
   * `true` and will allow any type of event be subscribed.
   *
   * @param type event type in question.
   * @returns `boolean` indicating whether or not this instance impliments
   * an event of type `type`
   */
  has<const K extends string | unknown>(type: K): type is K & KeysOf<ES> {
    if (typeof type === "string") {
      return type in this.constraints;
    }
    return true;
  }

  *eventTypes(): Generator<KeysOf<ES>> {
    for (const type of this.handlers.types()) {
      yield type;
    }
  }

  #dispatch<K extends KeysOf<ES>>(event: IDispatchedEvent<ES, K>): number {
    let count = 0;
    console.log(event.type);
    if (this.hasSubscribers(event.type)) {
      console.log(`has subs!: ${event.type}`);
      const runOnlyOnce = new Set<string>();
      for (const [key, handler] of this.handlers.entries(event.type)) {
        handler.handleEvent(event);
        if (handler.runOnce === true) runOnlyOnce.add(key);
        count++;
      }
      /* Clear those that run only once */
      for (const key of runOnlyOnce) {
        this.handlers.unsubscribeFrom(event.type, key);
      }
    }
    return count;
  }

  protected runTimeout(timeout: number | undefined, runFunction: Function) {
    if (timeout != null && typeof timeout === "number") {
      setTimeout(runFunction, timeout);
    } else {
      runFunction();
    }
  }

  dispatch<K extends LocalEventTypes<ES>>(
    type: K,
    params: IDispatchedParams<ES, K>
  ): void {
    /* Only used for local events */
    if (!this.has(type)) {
      throw new Error(`an event of type=${type} is not specified in passed parameters`);
    }
    if (this.constraints[type].broadcasted === true) {
      throw new Error(
        `an event of type=${type} has to be broadcasted, \`dispatch\` ` +
          `only used for local events`
      );
    }

    const event = this.createEvent(type, {
      ...params,
      isRemoteSubject: false,
    });

    this.runTimeout(params.timeout, () => {
      this.#dispatch(event);
    });
  }

  broadcast<K extends BroadcastedEventTypes<ES>>(
    type: K,
    params: IDispatchedParams<ES, K>
  ): void {
    if (!this.has(type)) {
      throw new Error(`an event of type=${type} is not specified in passed parameters`);
    }

    if (this.broadcastEnabled()) {
      if (this.constraints[type].broadcasted !== true) {
        throw new Error(
          `an event of type=${type} is a local event, \`broadcast\` ` +
            `only used for broadcasted events`
        );
      }

      const event = this.createEvent(type, {
        ...params,
        isRemoteSubject: false,
      });

      this.runTimeout(params.timeout, () => {
        /* Local dispatch */
        this.#dispatch(event);
        /* Broadcasted dispatch */
        this.channel.postMessage({
          ...event,
          isRemoteSubject: true,
        });
      });
    } else {
      throw new Error(
        `failed to broadcast an event of type=${type}, \`broadcastEnabled\` ` +
          `is set to \`false\`.`
      );
    }
  }

  dispose() {
    this.channel?.close();
    this.clear();
  }

  clear(): void {
    this.handlers.clear();
  }
}

export namespace IEventTests {
  export type DisplayRecord<T> = {
    [K in keyof T]: T[K];
  } & {};

  type BaseEvent = {
    subject: {};
  };
  export type ICreateEvent = {
    // type: "create";
    payload: {
      readonly message: "hello i was created";
    };
  };

  export type IRemovedEvent = {
    // type: "removed";
    payload: {
      readonly message: "bye i was removed ;(";
    };
  };

  export type IUpdatedEvent = {
    // type: "updated";
    payload: {
      readonly message: "ouch i was updated";
    };
    broadcasted: true;
  };

  export type Events = {
    created: ICreateEvent;
    removed: IRemovedEvent;
    updated: IUpdatedEvent;
  };
  const constrains: IEventSchemaConstraints<Events> = {
    created: {},
    removed: {
      broadcasted: false,
    },
    updated: {
      broadcasted: true,
    },
  };
  export type Broadcasted = BroadcastedEventTypes<Events>;
  export type Local = LocalEventTypes<Events>;
  try {
    let bus!: EventDispatcher<Events>;
    bus.subscribe(["created", "removed"], {
      handleEvent: (event) => {
        if (event.type === "removed") {
          event.payload.message === "bye i was removed ;(";
        }
        event.payload.message === "hello i was created";
      },
    });

    bus.dispatch("created", {
      payload: {
        message: "hello i was created",
      },
    });

    bus.broadcast("updated", {
      payload: {
        message: "ouch i was updated",
      },
    });

    const event = bus.createEvent("updated", {
      payload: {
        message: "ouch i was updated",
      },
      isRemoteSubject: false,
    });
  } catch {}
}
