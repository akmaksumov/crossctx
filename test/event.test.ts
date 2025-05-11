import { describe, expect, test, it } from "vitest";
import { EventDispatcher, IEventTypeMap } from "../src/event";
import { IEventSchemaConstraints, KeysOf } from "../src/core";

export type ICreatedEventSchema = {
  payload: {
    message: string;
  };
};

export type IDeletedEventSchema = {
  payload: {
    name: string;
    version: number;
  };
};

export type IUpdatedEventSchema = {
  payload: {
    message: string;
  };
  broadcasted: true;
};

export type EventsDemo = {
  created: ICreatedEventSchema;
  deleted: IDeletedEventSchema;
  updated: IUpdatedEventSchema;
};

const constraints: IEventSchemaConstraints<EventsDemo> = {
  created: {},
  deleted: {
    broadcasted: false,
  },
  updated: {
    broadcasted: true,
  },
} as const;

const typeEvents = ((): {
  [K in KeysOf<EventsDemo>]: K;
} => {
  const result = {};
  for (const key in constraints) {
    result[key] = key;
  }
  return result as any;
})();

describe("EventDispatcher", () => {
  const createdPayload = { message: "hello world" };
  const deletePayload = { name: "deleted", version: 1 };
  it("dispatches event", () => {
    let dispatchedFirst = false;
    let dispatchedSecond = false;
    const source = new EventDispatcher<EventsDemo>({ constraints });
    const unsub = source.subscribe("created", {
      handleEvent: ({ type, payload }) => {
        expect(type).toBe(typeEvents.created);
        expect(payload).toEqual(createdPayload);
        dispatchedFirst = true;
      },
    });
    const unsub2 = source.subscribe("created", {
      handleEvent: ({ type, payload }) => {
        expect(type).toBe(typeEvents.created);
        expect(payload).toEqual(createdPayload);
        dispatchedSecond = true;
      },
    });
    source.dispatch("created", {
      payload: createdPayload,
    });
    expect(dispatchedFirst).toBe(true);
    expect(dispatchedSecond).toBe(true);
  });

  it("handler with `runOnce` prop set true, runs only once", () => {
    let dispatched = false;
    let dispatchedCount = 0;
    const source = new EventDispatcher<EventsDemo>({ constraints });
    const unsub = source.subscribe("created", {
      runOnce: true,
      handleEvent: ({ type, payload }) => {
        expect(type).toBe(typeEvents.created);
        expect(payload).toEqual(createdPayload);
        dispatched = true;
        dispatchedCount++;
      },
    });
    source.dispatch("created", {
      payload: createdPayload,
    });
    source.dispatch("created", {
      payload: createdPayload,
    });
    expect(dispatched).toBe(true);
    expect(dispatchedCount).toBe(1);
  });

  it("handler removed before `dispatch` is called the second time", () => {
    let dispatched = false;
    let dispatchedCount = 0;
    const source = new EventDispatcher<EventsDemo>({ constraints });
    const unsub = source.subscribe("created", {
      handleEvent: ({ type, payload }) => {
        expect(type).toBe(typeEvents.created);
        expect(payload).toEqual(createdPayload);
        dispatched = true;
        dispatchedCount++;
      },
    });
    source.dispatch("created", {
      payload: createdPayload,
    });
    unsub.unsubscribe();
    source.dispatch("created", {
      payload: createdPayload,
    });
    expect(dispatched).toBe(true);
    expect(dispatchedCount).toBe(1);
  });

  it("handlers are clreared, before dispatched", () => {
    let dispatchedFirst = false;
    let dispatchedSecond = false;
    const source = new EventDispatcher<EventsDemo>({ constraints });
    const unsub = source.subscribe("created", {
      handleEvent: ({ type, payload }) => {
        expect(type).toBe(typeEvents.created);
        expect(payload).toEqual(createdPayload);
        dispatchedFirst = true;
      },
    });
    const unsub2 = source.subscribe("created", {
      handleEvent: ({ type, payload }) => {
        expect(type).toBe(typeEvents.created);
        expect(payload).toEqual(createdPayload);
        dispatchedSecond = true;
      },
    });
    source.dispatch("created", {
      payload: createdPayload,
    });
    expect(dispatchedFirst).toBe(true);
    expect(dispatchedSecond).toBe(true);
    dispatchedFirst = false;
    dispatchedSecond = false;
    source.clear();
    source.dispatch("created", {
      payload: createdPayload,
    });
    expect(dispatchedFirst).toBe(false);
    expect(dispatchedSecond).toBe(false);
  });

  it("subscribing to two events at once", () => {
    let dispatchedFirst = false;
    let dispatchedSecond = false;
    const source = new EventDispatcher<EventsDemo>({ constraints });
    const unsub = source.subscribe(["created", "deleted"], {
      handleEvent: ({ type, payload }) => {
        if (type === "created") {
          expect(type).toBe(typeEvents.created);
          expect(payload).toEqual(createdPayload);
          dispatchedFirst = true;
        } else if (type === "deleted") {
          expect(type).toBe(typeEvents.deleted);
          expect(payload).toEqual(deletePayload);
          dispatchedSecond = true;
        }
      },
    });

    source.dispatch("created", {
      payload: createdPayload,
    });
    expect(dispatchedFirst).toBe(true);
    expect(dispatchedSecond).toBe(false);
    source.dispatch("deleted", {
      payload: deletePayload,
    });
    expect(dispatchedSecond).toBe(true);
  });

  it("subscribing to two events at once and using `runOnce = true`", () => {
    let dispatchedFirst = false;
    let dispatchedSecond = false;
    const source = new EventDispatcher<EventsDemo>({ constraints });
    const unsub = source.subscribe(["created", "deleted"], {
      runOnce: true,
      handleEvent: ({ type, payload }) => {
        if (type === "created") {
          expect(type).toBe(typeEvents.created);
          expect(payload).toEqual(createdPayload);
          dispatchedFirst = true;
        } else if (type === "deleted") {
          expect(type).toBe(typeEvents.deleted);
          expect(payload).toEqual(deletePayload);
          dispatchedSecond = true;
        }
      },
    });

    source.dispatch("created", {
      payload: createdPayload,
    });
    expect(dispatchedFirst).toBe(true);
    expect(dispatchedSecond).toBe(false);
    /* should not run the second time */
    dispatchedFirst = false;
    source.dispatch("created", {
      payload: createdPayload,
    });
    expect(dispatchedFirst).toBe(false);
    source.dispatch("deleted", {
      payload: deletePayload,
    });
    expect(dispatchedSecond).toBe(true);
    /* should not run the second time */
    dispatchedSecond = false;
    source.dispatch("deleted", {
      payload: deletePayload,
    });
    expect(dispatchedSecond).toBe(false);
  });
});
