import {
  type DeepKeysOf,
  type IJoinKeys,
  type ISchemaType,
  type ISplitKey,
  type ISplittedKeysOf,
} from "typeslib";
import type {
  BroadcastedEventTypes,
  IBroadcastedSubject,
  IDispatchedParams,
  IEvent,
  IEventDispatcher,
  IEventHandlerMethod,
  IEventSchema,
  IEventSchemaConstraints,
  IEventSchemaMap,
  LocalEventTypes,
  ISubject,
  ISubscribtion,
  KeysOf,
  IDispatchedEvent,
  IExtractEvent,
  ISubscribeable,
  IDispatcher,
  Method,
  ExcludeBroadcastedEventTypes,
  IBroadcaster,
  IEventScheduler,
} from "./core.js";
import {
  EventDispatcher,
  SubscribeableAbstract,
  type EventBroadcaster,
} from "./event.js";
import type { DisplayRecord, UnionToIntersection } from "typeslib/dist/types.js";
import type { Test } from "./util.js";

type TODO = any;
export abstract class Subject<ES extends IEventSchemaMap = IEventSchemaMap>
  implements ISubject<ES>
{
  readonly constraints: IEventSchemaConstraints<ES>;
  abstract readonly metaName: string;
  #events?: EventDispatcher<ES>;
  constructor(params: { constraints: IEventSchemaConstraints<ES> }) {
    this.constraints = params.constraints;
  }

  protected get events(): EventDispatcher<ES> {
    if (this.#events == null) {
      this.#events = new EventDispatcher({ constraints: this.constraints });
    }
    return this.#events;
  }

  subscribe<K extends KeysOf<ES>>(
    type: K[],
    handler: {
      runOnce?: boolean;
      handleEvent: IEventHandlerMethod<ES, K>;
    }
  ): ISubscribtion {
    return this.events.subscribe(type, handler);
  }

  protected dispatch<K extends LocalEventTypes<ES>>(
    type: K,
    params: IDispatchedParams<ES, K>
  ): void {
    this.events.dispatch(type, params);
  }
}

export abstract class BroadcastedSubject<ES extends IEventSchemaMap = IEventSchemaMap>
  extends Subject<ES>
  implements IBroadcastedSubject<ES>
{
  /**
   * Must be unique for all instances per class. An instance with the same name, is
   * considered the same no matter what browsing context your in
   */
  abstract readonly uniqueName: string;
  #events?: EventBroadcaster<ES>;
  constructor(params: { constraints: IEventSchemaConstraints<ES> }) {
    super(params);
  }

  protected override get events(): EventDispatcher<ES> {
    if (this.#events == null) {
      const result = new EventDispatcher({
        constraints: this.constraints,
        broadcastEnabled: true,
        channelName: `${this.metaName}.${this.uniqueName}`,
      });
      if (result.broadcastEnabled()) {
        this.#events = result;
      } else {
        throw new Error();
      }
    }
    return this.#events;
  }

  protected broadcast<K extends BroadcastedEventTypes<ES>>(
    type: K,
    params: IDispatchedParams<ES, K>
  ): void {
    this.events.broadcast(type, params);
  }
}

export type DeepAccessKey<T extends ISchemaType> = DeepKeysOf<T> | "";
export type FlatAccessKey<T extends ISchemaType> = KeysOf<T> | "";
export type FlatAccessSplit<Full extends string, Part extends string> = Part extends ""
  ? Full
  : Full extends `${Part}.${infer Rest}`
  ? Rest
  : never;

export type FlatAccessJoin<Part extends string, Rest extends string> = Part extends ""
  ? Rest
  : `${Part}.${Rest}`;

export namespace EventSubject {
  export type RootAccessName = "";
  export type NodeAccessName<ISM extends MetaSchema> = DeepKeysOf<ISM>;
  export type AccessName<ISM extends MetaSchema> = NodeAccessName<ISM> | RootAccessName;
  export type NodeAccessJoin<
    Part extends string,
    Rest extends string
  > = `${Part}.${Rest}`;

  export interface MetaSchema {
    [type: string]: MetaSchema;
  }
  export interface Schema {
    readonly name: string;
  }
  export type EventSchema = IEventSchema & {
    payload: { subject: Schema };
  };
  export interface EventSchemaMap extends IEventSchemaMap {
    [type: string]: EventSchema;
  }
  export type EventMap<ISM extends MetaSchema> = {
    [K in DeepKeysOf<ISM>]: EventSchemaMap;
  };

  export type JoinedEventType<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM> = EventMap<ISM>
  > = KeysOf<JoinedEventMap<ISM, ESM>>;

  export type JoinedEventMap<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM> = EventMap<ISM>
  > = Extract<
    UnionToIntersection<
      {
        [EK in KeysOf<ESM> as number]: {
          [EKK in KeysOf<ESM[EK]> as `${EK}.${EKK}`]: ESM[EK][EKK];
        };
      }[number]
    >,
    EventSchemaMap
  >;

  export namespace DetachedEvent {
    export type ComputeEventType<
      ISM extends MetaSchema,
      ESM extends EventMap<ISM>,
      ISMK extends AccessName<ISM>
    > = {
      [K in ISMK]: {
        [JK in JoinedEventType<ISM, ESM>]: FlatAccessSplit<JK, K>;
      }[JoinedEventType<ISM, ESM>];
    }[ISMK];

    export type ComputeEventValue<
      ISM extends MetaSchema,
      ESM extends EventMap<ISM>,
      K extends AccessName<ISM>,
      KK extends ComputeEventType<ISM, ESM, K>
    > = {
      [KKK in FlatAccessJoin<K, KK>]: KKK extends keyof JoinedEventMap<ISM, ESM>
        ? JoinedEventMap<ISM, ESM>[KKK]
        : never;
    }[FlatAccessJoin<K, KK>];
  }

  export type DetachedEventMap<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM>,
    ISMK extends AccessName<ISM>
  > = {
    [K in ISMK]: {
      [KK in DetachedEvent.ComputeEventType<
        ISM,
        ESM,
        K
      >]: DetachedEvent.ComputeEventValue<ISM, ESM, K, KK>;
    };
  }[ISMK];

  export type DetachedEventTypeMap<> = {};
  export type DetachedEventType<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM>,
    ISMK extends AccessName<ISM>
  > = Extract<keyof DetachedEventMap<ISM, ESM, ISMK>, string>;

  export type ExcludeBroadcastedTypes<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM>,
    ISMK extends AccessName<ISM>
  > = ExcludeBroadcastedEventTypes<DetachedEventMap<ISM, ESM, ISMK>>;

  export type BroadcastedTypes<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM>,
    ISMK extends AccessName<ISM>
  > = BroadcastedEventTypes<DetachedEventMap<ISM, ESM, ISMK>>;

  export type EventTypeRoot<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM>
  > = DetachedEventType<ISM, ESM, "">;

  export type DispatchedEvent<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM>,
    ISMK extends AccessName<ISM>,
    K extends DetachedEventType<ISM, ESM, ISMK> = DetachedEventType<ISM, ESM, ISMK>
  > = IDispatchedEvent<DetachedEventMap<ISM, ESM, ISMK>, K>;

  export type DispatchedEventRoot<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM>,
    K extends EventTypeRoot<ISM, ESM> = EventTypeRoot<ISM, ESM>
  > = IDispatchedEvent<DetachedEventMap<ISM, ESM, "">, K>;

  export type ConvertRootToNodeEvent<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM>,
    ISMK extends AccessName<ISM>,
    RE extends DispatchedEventRoot<ISM, ESM>
  > = {
    [KR in RE["type"]]: DispatchedEvent<
      ISM,
      ESM,
      ISMK,
      ConvertRootTypeToNode<ISM, ESM, ISMK, KR>
    >;
  }[RE["type"]];

  export type ConvertNodeTypeToRoot<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM>,
    ISMK extends AccessName<ISM>,
    K extends DetachedEventType<ISM, ESM, ISMK> = DetachedEventType<ISM, ESM, ISMK>
  > = NodeAccessJoin<ISMK, K> & EventTypeRoot<ISM, ESM>;

  export type ConvertRootTypeToNode<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM>,
    ISMK extends AccessName<ISM>,
    RK extends EventTypeRoot<ISM, ESM>
  > = FlatAccessSplit<RK, ISMK> & DetachedEventType<ISM, ESM, ISMK>;

  interface EventHandlerParam<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM>,
    ISMK extends AccessName<ISM>,
    K extends DetachedEventType<ISM, ESM, ISMK>
  > {
    runOnce?: boolean;
    handleEvent: IEventHandlerMethod<DetachedEventMap<ISM, ESM, ISMK>, K>;
  }

  export type ConvertedEventHandlerParam<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM>,
    ISMK extends AccessName<ISM>,
    K extends DetachedEventType<ISM, ESM, ISMK>
  > = EventHandlerParam<ISM, ESM, "", ConvertNodeTypeToRoot<ISM, ESM, ISMK, K>>;

  export interface EventScheduler<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM>,
    ISMK extends AccessName<ISM>
  > extends IEventScheduler<DetachedEventMap<ISM, ESM, ISMK>> {}

  export type EventSchemaConstraints<
    ISM extends MetaSchema,
    ESM extends EventMap<ISM>,
    ISMK extends AccessName<ISM>
  > = IEventSchemaConstraints<DetachedEventMap<ISM, ESM, ISMK>>;

  export interface Node<
    ISM extends MetaSchema = MetaSchema,
    ESM extends EventMap<ISM> = EventMap<ISM>,
    ISMK extends NodeAccessName<ISM> = NodeAccessName<ISM>
  > extends EventScheduler<ISM, ESM, ISMK> {
    readonly metaName: ISMK;
    readonly bus: Bus<ISM, ESM>;
    asRootType<const K extends DetachedEventType<ISM, ESM, ISMK>>(
      type: K
    ): NodeAccessJoin<ISMK, K> & EventTypeRoot<ISM, ESM>;
    asNodeType<const K extends EventTypeRoot<ISM, ESM>>(
      type: K
    ): ConvertRootTypeToNode<ISM, ESM, ISMK, K>;
  }

  export interface Bus<
    ISM extends MetaSchema = MetaSchema,
    ESM extends EventMap<ISM> = EventMap<ISM>
  > extends EventScheduler<ISM, ESM, ""> {
    use<K extends NodeAccessName<ISM>>(metaName: K): Node<ISM, ESM, K>;
  }

  export class AbstractBus<
      ISM extends MetaSchema = MetaSchema,
      ESM extends EventMap<ISM> = EventMap<ISM>
    >
    extends SubscribeableAbstract<DetachedEventMap<ISM, ESM, "">>
    implements Bus<ISM, ESM>
  {
    readonly constraints: EventSchemaConstraints<ISM, ESM, "">;
    protected readonly scheduler!: EventDispatcher<DetachedEventMap<ISM, ESM, "">>;
    constructor(params: { constraints: EventSchemaConstraints<ISM, ESM, ""> }) {
      super();
      this.constraints = params.constraints;
    }

    has<const K extends string>(type: K): type is K & EventTypeRoot<ISM, ESM> {
      return type in this.constraints;
    }

    dispatch<K extends ExcludeBroadcastedTypes<ISM, ESM, "">>(
      type: K,
      params: IDispatchedParams<DetachedEventMap<ISM, ESM, "">, K>
    ): this {
      this.scheduler.dispatch(type, params);
      return this;
    }

    broadcast<K extends BroadcastedTypes<ISM, ESM, "">>(
      type: K,
      params: IDispatchedParams<DetachedEventMap<ISM, ESM, "">, K>
    ): this {
      this.scheduler.broadcast(type, params);
      return this;
    }

    protected subscribeRest<const K extends DetachedEventType<ISM, ESM, "">>(
      types: K[],
      handler: EventHandlerParam<ISM, ESM, "", K>
    ): ISubscribtion {
      return this.scheduler.subscribe(types, handler);
    }

    use<K extends NodeAccessName<ISM>>(metaName: K): Node<ISM, ESM, K> {
      return new AbstractNode({ bus: this, metaName });
    }
  }

  export class AbstractNode<
      ISM extends MetaSchema = MetaSchema,
      ESM extends EventMap<ISM> = EventMap<ISM>,
      ISMK extends NodeAccessName<ISM> = NodeAccessName<ISM>
    >
    extends SubscribeableAbstract<DetachedEventMap<ISM, ESM, ISMK>>
    implements Node<ISM, ESM, ISMK>
  {
    readonly metaName!: ISMK;
    readonly bus!: Bus<ISM, ESM>;
    constructor(params: { metaName: ISMK; bus: Bus<ISM, ESM> }) {
      super();
      this.metaName = params.metaName;
      this.bus = params.bus;
    }

    has<const K extends string>(
      type: K
    ): type is K & Extract<keyof DetachedEventMap<ISM, ESM, ISMK>, string> {
      return this.bus.has(this.asRootType(type as TODO));
    }

    dispatch<K extends ExcludeBroadcastedTypes<ISM, ESM, ISMK>>(
      type: K,
      params: IDispatchedParams<DetachedEventMap<ISM, ESM, ISMK>, K>
    ): this {
      this.bus.dispatch(this.asRootType(type) as TODO, params);
      return this;
    }

    broadcast<K extends BroadcastedTypes<ISM, ESM, ISMK>>(
      type: K,
      params: IDispatchedParams<DetachedEventMap<ISM, ESM, ISMK>, K>
    ): this {
      this.bus.broadcast(this.asRootType(type) as TODO, params);
      return this;
    }

    asRootType<const K extends DetachedEventType<ISM, ESM, ISMK>>(
      type: K
    ): ConvertNodeTypeToRoot<ISM, ESM, ISMK, K> {
      if (this.metaName === "") {
        /* this means `root` and shouldn't technically happen */
        return type as any;
      }
      return `${this.metaName}.${type}` as any;
    }

    asNodeType<const K extends EventTypeRoot<ISM, ESM>>(
      type: K
    ): ConvertRootTypeToNode<ISM, ESM, ISMK, K> {
      if (this.metaName === "") {
        /* this means `root` and shouldn't technically happen */
        return type as any;
      }
      return type.slice(this.metaName.length + 1) as ConvertRootTypeToNode<
        ISM,
        ESM,
        ISMK,
        K
      >;
    }

    protected asNodeEvent<
      E extends DispatchedEventRoot<ISM, ESM, ConvertNodeTypeToRoot<ISM, ESM, ISMK>>
    >(event: E): ConvertRootToNodeEvent<ISM, ESM, ISMK, E> {
      return {
        ...event,
        type: this.asNodeType(event.type),
      } as TODO;
    }

    protected convertParams<const K extends DetachedEventType<ISM, ESM, ISMK>>(
      types: K[],
      handler: EventHandlerParam<ISM, ESM, ISMK, K>
    ): [
      ConvertNodeTypeToRoot<ISM, ESM, ISMK, K>[],
      ConvertedEventHandlerParam<ISM, ESM, ISMK, K>
    ] {
      const mapped = types.map((value) => {
        return this.asRootType(value);
      });

      const handlerOut = {
        runOnce: handler.runOnce,
        handleEvent: (
          event: DispatchedEventRoot<ISM, ESM, ConvertNodeTypeToRoot<ISM, ESM, ISMK, K>>
        ): void => {
          const inverseEvent = this.asNodeEvent(event);
          handler.handleEvent(inverseEvent as TODO);
        },
      };
      return [mapped, handlerOut];
    }

    protected subscribeRest<const K extends DetachedEventType<ISM, ESM, ISMK>>(
      types: K[],
      handler: EventHandlerParam<ISM, ESM, ISMK, K>
    ): ISubscribtion {
      const [mappedTypes, mappedHandler] = this.convertParams(types, handler);
      return this.bus.subscribe(mappedTypes, mappedHandler);
    }
  }
}

namespace EventSubjectTests {
  export const runFunction = () => {
    let node!: EventSubject.Node<
      indexedDBSubjectMap,
      indexedDBEventMap,
      "database.collection"
    >;
    let bus!: EventSubject.Bus<indexedDBSubjectMap, indexedDBEventMap>;
    node.subscribe(["recordsCreated", "recordsUpdated", "recordsDeleted"], {
      handleEvent: (event) => {
        if (event.type === "recordsDeleted") return;
        const { records } = event.payload;
      },
    });

    bus.subscribe(["database.collectionsCreated"], {
      handleEvent: (event) => {
        const { collections } = event.payload;
      },
    });

    const detachedNode = bus.use("database.collection");

    bus
      .use("database.collection")
      .subscribe(["recordsCreated", "recordsUpdated", "recordsDeleted"], {
        handleEvent: (event) => {
          if (event.type === "recordsDeleted") return;
          const { records } = event.payload;
        },
      });

    bus
      .use("database")
      .subscribe(["opened", "collectionsCreated", "collection.recordsUpdated"], {
        handleEvent: (event) => {},
      });

    bus
      .use("database.collection")
      .dispatch("recordsCreated", {
        payload: {
          subject: {
            databaseName: "metaDatabase",
            name: "akmal",
            primaryKey: "__id",
          },
          records: [],
        },
      })
      .dispatch("recordsDeleted", {
        payload: {
          subject: {
            databaseName: "metaDatabase",
            name: "akmal",
            primaryKey: "__id",
          },
          primaryKeyValues: [],
        },
      });

    detachedNode.subscribe(["recordsCreated", "recordsUpdated", "recordsDeleted"], {
      handleEvent: (event) => {
        if (event.type === "recordsDeleted") return;
        const { records } = event.payload;
      },
    });
  };
  export type indexedDBSubjectMap = {
    database: {
      collection: {};
    };
  };

  type Database = {
    name: string;
    version: number;
  };

  type Collection = {
    name: string;
    databaseName: string;
    primaryKey: string;
  };

  type ResolvedRecord = {
    id: number;
    createdTime: Date;
  };

  export type indexedDBEventMap = {
    database: {
      opened: {
        broadcasted: true;
        payload: {
          subject: Database;
        };
      };
      collectionsCreated: {
        broadcasted: true;
        payload: {
          subject: Database;
          collections: Collection[];
        };
      };
    };
    "database.collection": {
      recordsCreated: {
        payload: {
          subject: Collection;
          records: ResolvedRecord[];
        };
      };
      recordsUpdated: {
        payload: {
          subject: Collection;
          records: ResolvedRecord[];
        };
      };
      recordsDeleted: {
        payload: {
          subject: Collection;
          primaryKeyValues: string[];
        };
      };
    };
  };

  export type rootEventTypes = EventSubject.EventTypeRoot<
    indexedDBSubjectMap,
    indexedDBEventMap
  >;

  export type rootEvent = EventSubject.DispatchedEventRoot<
    indexedDBSubjectMap,
    indexedDBEventMap
  >;

  export type CONVERT_EVENT = Test.ExpectRecord<{
    [ISMK in EventSubject.AccessName<indexedDBSubjectMap>]: Test.Equal<
      EventSubject.ConvertRootToNodeEvent<
        indexedDBSubjectMap,
        indexedDBEventMap,
        ISMK,
        rootEvent
      >,
      EventSubject.DispatchedEvent<indexedDBSubjectMap, indexedDBEventMap, ISMK>
    >;
  }>;

  export type CONVERT_ROOT_TYPE_TO_NODE = Test.ExpectRecord<{
    [ISMK in EventSubject.AccessName<indexedDBSubjectMap>]: Test.Equal<
      EventSubject.ConvertRootTypeToNode<
        indexedDBSubjectMap,
        indexedDBEventMap,
        ISMK,
        rootEventTypes
      >,
      EventSubject.DetachedEventType<indexedDBSubjectMap, indexedDBEventMap, ISMK>
    >;
  }>;

  export type ROOT_JOINED_EVENT_MAP = Test.Expect<
    Test.Equal<
      EventSubject.JoinedEventMap<indexedDBSubjectMap, indexedDBEventMap>,
      {
        "database.collection.recordsCreated": {
          payload: {
            subject: Collection;
            records: ResolvedRecord[];
          };
        };
        "database.collection.recordsUpdated": {
          payload: {
            subject: Collection;
            records: ResolvedRecord[];
          };
        };
        "database.collection.recordsDeleted": {
          payload: {
            subject: Collection;
            primaryKeyValues: string[];
          };
        };
      } & {
        "database.opened": {
          broadcasted: true;
          payload: {
            subject: Database;
          };
        };
        "database.collectionsCreated": {
          broadcasted: true;
          payload: {
            subject: Database;
            collections: Collection[];
          };
        };
      }
    >
  >;

  export type ROOT_DETACHED_EVENT_MAP = Test.Expect<
    Test.Equal<
      EventSubject.DetachedEventMap<indexedDBSubjectMap, indexedDBEventMap, "">,
      {
        "database.collection.recordsCreated": {
          payload: {
            subject: Collection;
            records: ResolvedRecord[];
          };
        };
        "database.collection.recordsUpdated": {
          payload: {
            subject: Collection;
            records: ResolvedRecord[];
          };
        };
        "database.collection.recordsDeleted": {
          payload: {
            subject: Collection;
            primaryKeyValues: string[];
          };
        };
        "database.opened": {
          broadcasted: true;
          payload: {
            subject: Database;
          };
        };
        "database.collectionsCreated": {
          broadcasted: true;
          payload: {
            subject: Database;
            collections: Collection[];
          };
        };
      }
    >
  >;

  export type DATABASE_DETACHED_EVENT_MAP = Test.Expect<
    Test.Equal<
      EventSubject.DetachedEventMap<indexedDBSubjectMap, indexedDBEventMap, "database">,
      {
        opened: {
          broadcasted: true;
          payload: {
            subject: Database;
          };
        };
        collectionsCreated: {
          broadcasted: true;
          payload: {
            subject: Database;
            collections: Collection[];
          };
        };
        "collection.recordsCreated": {
          payload: {
            subject: Collection;
            records: ResolvedRecord[];
          };
        };
        "collection.recordsUpdated": {
          payload: {
            subject: Collection;
            records: ResolvedRecord[];
          };
        };
        "collection.recordsDeleted": {
          payload: {
            subject: Collection;
            primaryKeyValues: string[];
          };
        };
      }
    >
  >;

  export type COLLECTION_DETACHED_EVENT_MAP = Test.Expect<
    Test.Equal<
      EventSubject.DetachedEventMap<
        indexedDBSubjectMap,
        indexedDBEventMap,
        "database.collection"
      >,
      {
        recordsCreated: {
          payload: {
            subject: Collection;
            records: ResolvedRecord[];
          };
        };
        recordsUpdated: {
          payload: {
            subject: Collection;
            records: ResolvedRecord[];
          };
        };
        recordsDeleted: {
          payload: {
            subject: Collection;
            primaryKeyValues: string[];
          };
        };
      }
    >
  >;
}
