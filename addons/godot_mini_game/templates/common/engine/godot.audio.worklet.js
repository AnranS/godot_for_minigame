// Godot audio worklet stub — safe to compile in any JS scope.
// The actual audio processing is handled by the native WebAudioContext.
if (typeof AudioWorkletProcessor !== "undefined" && typeof registerProcessor !== "undefined") {
  class GodotProcessor extends AudioWorkletProcessor {
    process(inputs, outputs) {
      const input = inputs[0]; const output = outputs[0];
      for (let ch = 0; ch < output.length; ch++) {
        output[ch].set(input && input[ch] ? input[ch] : new Float32Array(output[ch].length));
      }
      return true;
    }
  }
  registerProcessor("godot-processor", GodotProcessor);
}
