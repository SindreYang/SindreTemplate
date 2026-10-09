export interface HistoryOptions<T> {
  limit?: number;
  equals?: (a: T, b: T) => boolean;
}

export interface History<T> {
  get(): T;
  commit(value: T): T;
  replace(value: T): T;
  undo(): T;
  redo(): T;
  reset(value?: T): T;
  can_undo(): boolean;
  can_redo(): boolean;
  size(): number;
}

/** Small immutable-by-convention undo/redo stack. Commit copies when callers need snapshots. */
export function create_history<T>(initial: T, options: HistoryOptions<T> = {}): History<T> {
  const limit = options.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError("limit must be a positive integer");
  const equals = options.equals ?? Object.is;
  let entries = [initial];
  let index = 0;

  const current = () => entries[index] as T;
  const commit = (value: T) => {
    if (equals(current(), value)) return current();
    entries = entries.slice(0, index + 1);
    entries.push(value);
    if (entries.length > limit) entries.shift();
    index = entries.length - 1;
    return current();
  };

  return {
    get: current,
    commit,
    replace: (value) => {
      if (!equals(current(), value)) entries[index] = value;
      return current();
    },
    undo: () => { if (index > 0) index--; return current(); },
    redo: () => { if (index < entries.length - 1) index++; return current(); },
    reset: (value = initial) => { entries = [value]; index = 0; return value; },
    can_undo: () => index > 0,
    can_redo: () => index < entries.length - 1,
    size: () => entries.length,
  };
}
