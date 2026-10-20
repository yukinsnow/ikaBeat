export interface Analysis {
  bpm: number;
  confidence: number;
  beats: number[];
  duration: number;
  waveform: number[];
}
export const MAX_BYTES = 80 * 1024 * 1024;
export const MAX_SECONDS = 10 * 60;
export function waveformOf(samples: Float32Array, bins = 100): number[] {
  const width = Math.max(1, Math.ceil(samples.length / bins));
  return Array.from({ length: Math.min(bins, samples.length) }, (_, i) => {
    let peak = 0;
    for (let j = i * width; j < Math.min((i + 1) * width, samples.length); j++)
      peak = Math.max(peak, Math.abs(samples[j]));
    return peak;
  });
}
export async function analyze(
  file: File,
  signal: AbortSignal,
  stage: (text: string) => void,
): Promise<Analysis> {
  signal.throwIfAborted();
  if (file.size > MAX_BYTES)
    throw new Error("文件超过 80 MB，请先裁剪或压缩。");
  stage("正在解码");
  const context = new AudioContext();
  // decodeAudioData itself is not abortable. Check cancellation immediately after it.
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error("系统无法解码此格式，请转换为 WAV 或 MP3 后重试。");
  } finally {
    await context.close();
  }
  signal.throwIfAborted();
  if (decoded.duration > MAX_SECONDS)
    throw new Error("音频超过 10 分钟，请先裁剪。");
  if (decoded.duration < 5) throw new Error("音频至少需要 5 秒。");
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * 44100),
    44100,
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const resampled = await offline.startRendering();
  signal.throwIfAborted();
  const samples = resampled.getChannelData(0);
  const waveform = waveformOf(samples);
  stage("正在计算BPM");
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("/analysis-worker.js", window.location.href),
    );
    const finish = () => {
      worker.terminate();
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
    };
    const cancel = () => {
      finish();
      reject(new DOMException("已取消", "AbortError"));
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error("分析超时，请使用更短的音频重试。"));
    }, 180_000);
    signal.addEventListener("abort", cancel, { once: true });
    worker.onerror = () => {
      finish();
      reject(new Error("分析引擎加载失败，请重新打开应用。"));
    };
    worker.onmessage = ({ data }) => {
      finish();
      if (data.error) reject(new Error(data.error));
      else resolve({ ...data, duration: decoded.duration, waveform });
    };
    worker.postMessage({ samples: samples.buffer }, [samples.buffer]);
  });
}
