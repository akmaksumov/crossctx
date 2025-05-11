import { describe, expect, test, it } from "vitest";
import { Signal } from "../src/signal";

describe("Signal", () => {
  it("only emits on value changed", () => {
    let emitted = false;
    let values = [1, 1, 2, 3, 4];
    let executeCount = 0;
    let index = 0;
    const signal = new Signal<number>({ name: "signal", emitOnValueChanged: true });
    const unsub = signal.subscribe((value, prevValue) => {
      emitted = true;
      executeCount++;
      expect(value).toBe(values[index - 1]);
      if (index > 2) {
        expect(prevValue).toBe(values[index - 2]);
      }
    });

    signal.emit(values[index++]);
    expect(emitted).toBe(true);
    expect(executeCount).toBe(1);

    signal.emit(values[index++]);
    expect(executeCount).toBe(1);

    signal.emit(values[index++]);
    expect(executeCount).toBe(2);

    signal.emit(values[index++]);
    expect(executeCount).toBe(3);

    unsub.unsubscribe();
    signal.emit(values[index++]);
    expect(executeCount).toBe(3);
  });
});
