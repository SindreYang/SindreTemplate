/** Cache a module or resource after first use; retry after a failed import. */
export function lazy_module<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => pending ??= load().catch((reason: unknown) => {
    pending = undefined;
    throw reason;
  });
}

/** Share concurrent loads by key and retry a key after failure. */
export function lazy_keyed<K, T>(load: (key: K) => Promise<T>): (key: K) => Promise<T> {
  const entries = new Map<K, Promise<T>>();
  return (key) => {
    const existing = entries.get(key);
    if (existing) return existing;
    const pending = Promise.resolve().then(() => load(key)).catch((reason: unknown) => {
      entries.delete(key);
      throw reason;
    });
    entries.set(key, pending);
    return pending;
  };
}
