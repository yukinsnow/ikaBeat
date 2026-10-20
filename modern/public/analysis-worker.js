/* Essentia owns the DSP. Each worker handles one track and is then terminated,
   reclaiming its WASM heap, including in cancellation/error paths. */
// The "web" build is window-only. The UMD build supports workers and embeds WASM.
let ready, failed;
const engine = new Promise((resolve, reject) => {
  ready = resolve;
  failed = reject;
});
var exports = {};
var Module = {
  onRuntimeInitialized: () => ready(new Essentia(Module)),
  onAbort: (reason) => failed(new Error(String(reason))),
};
importScripts("./vendor/essentia.js-core.js", "./vendor/essentia-wasm.umd.js");
self.onmessage = async ({ data }) => {
  let signal, output;
  try {
    const essentia = await engine;
    const samples = new Float32Array(data.samples);
    if (samples.length < 44100 * 5) throw new Error("音频至少需要 5 秒。");
    let peak = 0;
    for (let i = 0; i < samples.length; i++)
      peak = Math.max(peak, Math.abs(samples[i]));
    if (peak < 0.00001) throw new Error("音频为静音，无法检测节拍。");
    signal = essentia.arrayToVector(samples);
    output = essentia.RhythmExtractor2013(signal, 208, "multifeature", 40);
    if (!Number.isFinite(output.bpm) || output.bpm <= 0)
      throw new Error("未检测到稳定节拍。");
    const beats = Array.from({ length: output.ticks.size() }, (_, i) =>
      output.ticks.get(i),
    );
    self.postMessage({ bpm: output.bpm, confidence: output.confidence, beats });
  } catch (error) {
    self.postMessage({
      error:
        typeof error === "number"
          ? "分析引擎无法处理此音频。"
          : String(error?.message || error),
    });
  } finally {
    signal?.delete();
    for (const key of ["ticks", "estimates", "bpmIntervals"])
      output?.[key]?.delete();
  }
};
