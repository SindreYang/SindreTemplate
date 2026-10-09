/** TensorFlow.js graph-model lifecycle. Caller owns input and output tensors. */
import * as tf from "@tensorflow/tfjs";

export async function get_graph_runner(source: Parameters<typeof tf.loadGraphModel>[0]) {
  const model = await tf.loadGraphModel(source);
  let closed = false;
  return {
    model,
    async run(inputs: Parameters<typeof model.executeAsync>[0]) {
      if (closed) throw new Error("graph runner is disposed");
      return model.executeAsync(inputs);
    },
    dispose() { if (!closed) { model.dispose(); closed = true; } },
  };
}

/** Dispose outputs after their values have been copied; do not pass input tensors. */
export function dispose_graph_output(output: tf.Tensor | tf.Tensor[] | tf.NamedTensorMap): void {
  tf.dispose(output);
}
