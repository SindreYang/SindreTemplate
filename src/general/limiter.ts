export interface FixedWindowLimiterOptions {
  max: number;
  window_ms: number;
  max_entries?: number;
  now?: () => number;
}

export interface FixedWindowLimit {
  limited: boolean;
  remaining: number;
  retry_after_ms: number;
}

export interface FixedWindowLimiter<K> {
  check(key: K): FixedWindowLimit;
  record(key: K): FixedWindowLimit;
  reset(key: K): void;
}

/** In-memory fixed-window limiter for one process. Use shared storage for distributed limits. */
export function create_fixed_window_limiter<K = string>(options: FixedWindowLimiterOptions): FixedWindowLimiter<K> {
  const { max, window_ms, max_entries = 10_000, now = Date.now } = options;
  if (!Number.isSafeInteger(max) || max < 1) throw new RangeError("max must be a positive integer");
  if (!Number.isFinite(window_ms) || window_ms <= 0) throw new RangeError("window_ms must be positive");
  if (!Number.isSafeInteger(max_entries) || max_entries < 1) throw new RangeError("max_entries must be a positive integer");
  const entries = new Map<K, { count: number; reset_at: number }>();

  const prune = (timestamp: number) => {
    for (const [key, entry] of entries) if (entry.reset_at <= timestamp) entries.delete(key);
  };

  const get = (key: K, timestamp: number) => {
    const entry = entries.get(key);
    if (!entry || entry.reset_at <= timestamp) {
      entries.delete(key);
      return { count: 0, reset_at: timestamp + window_ms };
    }
    return entry;
  };
  const result = (entry: { count: number; reset_at: number }, timestamp: number): FixedWindowLimit => ({
    limited: entry.count >= max,
    remaining: Math.max(0, max - entry.count),
    retry_after_ms: entry.count >= max ? Math.max(0, entry.reset_at - timestamp) : 0,
  });

  return {
    check: (key) => { const timestamp = now(); return result(get(key, timestamp), timestamp); },
    record: (key) => {
      const timestamp = now();
      if (!entries.has(key) && entries.size >= max_entries) {
        prune(timestamp);
        if (entries.size >= max_entries) entries.delete(entries.keys().next().value as K);
      }
      const entry = get(key, timestamp);
      if (entry.count < max) entry.count++;
      entries.set(key, entry);
      return result(entry, timestamp);
    },
    reset: (key) => { entries.delete(key); },
  };
}
