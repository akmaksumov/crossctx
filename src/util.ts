export namespace Test {
  export type Expect<T extends true> = T;
  export type ExpectFalse<T extends false> = T;
  export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y
    ? 1
    : 2
    ? true
    : false;
  export type Extends<T, B> = [T] extends [B] ? true : false;
  export type ExpectRecord<T extends Record<keyof any, true>> = T;
}
export type NativeTypeName = Extract<keyof NativeTypes, string>;
export type NativeValue = NativeTypes[NativeTypeName];
export type LiteralValue = Exclude<NativeValue, object | Function> | null;
export type NativeTypes = {
  string: string;
  number: number;
  bigint: bigint;
  boolean: boolean;
  symbol: symbol;
  undefined: undefined;
  object: object;
  function: Function;
};
export function isNative<T extends NativeValue | unknown, const N extends NativeTypeName>(
  value: T,
  typeName: N | N[]
): value is T & NativeTypes[N] {
  const typeValue = typeof value;
  const typeNames = Array.isArray(typeName) ? typeName : [typeName];
  for (const type of typeNames) {
    if (typeValue === type) return true;
  }
  return false;
}

export function assertIsNative<
  T extends NativeValue | unknown,
  const N extends NativeTypeName
>(value: T, typeName: N | N[]): asserts value is T & NativeTypes[N] {
  if (isNative(value, typeName)) return;
  throw new TypeError(`assertion failed, \`value\` is not of type=${typeName}`);
}

export function uniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
