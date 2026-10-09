/** Shared lifecycle for web and native ONNX sessions; runtime packages stay in their own entries. */
export function createRunner<T extends {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run: (...args: any[]) => Promise<any>;
  release: () => Promise<void>;
}>(session: T) {
  let closed = false;
  return {
    session,
    get inputNames() { return session.inputNames; },
    get outputNames() { return session.outputNames; },
    run(...args: Parameters<T["run"]>): ReturnType<T["run"]> {
      if (closed) throw new Error("ONNX runner is released");
      return session.run(...args) as ReturnType<T["run"]>;
    },
    async release() { if (!closed) { closed = true; await session.release(); } },
  };
}
