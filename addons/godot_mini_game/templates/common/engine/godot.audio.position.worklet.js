// Godot position-reporting worklet stub — safe to compile in any JS scope.
if (typeof AudioWorkletProcessor !== "undefined" && typeof registerProcessor !== "undefined") {
  class GodotPositionReportingProcessor extends AudioWorkletProcessor {
    constructor() { super(); this._pos = 0; }
    static get parameterDescriptors() {
      return [{ name: "reset", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" }];
    }
    process(inputs, outputs, parameters) {
      if (parameters["reset"] && parameters["reset"][0] > 0.5) this._pos = 0;
      const inp = inputs[0]; const out = outputs[0];
      if (inp && inp[0]) {
        this._pos += inp[0].length;
        this.port.postMessage({ type: "position", data: String(this._pos) });
        for (let ch = 0; ch < out.length; ch++) if (inp[ch]) out[ch].set(inp[ch]);
      }
      return true;
    }
  }
  registerProcessor("godot-position-reporting-processor", GodotPositionReportingProcessor);
}
