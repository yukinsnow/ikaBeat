import type { Analysis } from "./audio";
export interface Track {
  id: string;
  name: string;
  size: number;
  status: "queued" | "working" | "done" | "error" | "cancelled";
  stage?: string;
  result?: Analysis;
  error?: string;
}
export function csvOf(tracks: Track[]): string {
  const cell = (s: string) =>
    `"${(/^[=+@\-\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""')}"`;
  return (
    "\uFEFF" +
    [
      "文件名,BPM,原始置信度,时长（秒）,状态",
      ...tracks.map((t) =>
        [
          cell(t.name),
          t.result?.bpm.toFixed(2) ?? "",
          t.result?.confidence.toFixed(3) ?? "",
          t.result?.duration.toFixed(2) ?? "",
          t.status,
        ].join(","),
      ),
    ].join("\r\n")
  );
}
export function restoreHistory(raw: string | null): Track[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (t): t is Track =>
          t &&
          typeof t.id === "string" &&
          typeof t.name === "string" &&
          t.status === "done" &&
          Number.isFinite(t.result?.bpm) &&
          Number.isFinite(t.result?.confidence) &&
          Number.isFinite(t.result?.duration) &&
          Array.isArray(t.result?.waveform) &&
          t.result.waveform.every(
            (n: unknown) => typeof n === "number" && Number.isFinite(n),
          ),
      )
      .slice(0, 100);
  } catch {
    return [];
  }
}
