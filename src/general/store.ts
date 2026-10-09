export interface VersionedValue<T, V> {
  value: T;
  version: V;
}

export interface VersionedStoreOptions<T, V> {
  read: () => Promise<VersionedValue<T, V>> | VersionedValue<T, V>;
  write: (value: T) => Promise<VersionedValue<T, V>> | VersionedValue<T, V>;
}

export type StoreUpdate<T, V> =
  | { ok: true; value: T; version: V }
  | { ok: false; reason: "conflict"; current: VersionedValue<T, V> };

export interface VersionedStore<T, V> {
  read(): Promise<VersionedValue<T, V>>;
  update(
    expectedVersion: V,
    change: (value: T, version: V) => T | Promise<T>,
  ): Promise<StoreUpdate<T, V>>;
}

/** Serializes updates and rejects stale writes without imposing a storage format. */
export function create_versioned_store<T, V>(options: VersionedStoreOptions<T, V>): VersionedStore<T, V> {
  let queue = Promise.resolve();
  const enqueue = <R>(operation: () => Promise<R>): Promise<R> => {
    const next = queue.then(operation);
    queue = next.then(() => undefined, () => undefined);
    return next;
  };

  return {
    read: () => enqueue(() => Promise.resolve(options.read())),
    update: (expectedVersion, change) => enqueue(async () => {
      const current = await options.read();
      if (!Object.is(current.version, expectedVersion)) {
        return { ok: false, reason: "conflict", current };
      }
      const value = await change(current.value, current.version);
      const saved = await options.write(value);
      return { ok: true, value: saved.value, version: saved.version };
    }),
  };
}
