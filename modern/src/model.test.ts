import { describe, expect, it } from "vitest";
import { csvOf, restoreHistory, type Track } from "./model";
import { waveformOf } from "./audio";
describe("history and export boundaries", () => {
  it("recovers safely from corrupt storage and excludes unfinished work", () => {
    expect(restoreHistory("{broken")).toEqual([]);
    expect(restoreHistory('{"id":1}')).toEqual([]);
    expect(
      restoreHistory('[{"id":"x","name":"a.wav","status":"working"}]'),
    ).toEqual([]);
    expect(
      restoreHistory(
        '[{"id":"x","name":"a.wav","status":"done","result":{"bpm":"120"}}]',
      ),
    ).toEqual([]);
  });
  it("quotes file names and neutralizes spreadsheet formulas", () => {
    const tracks: Track[] = [
      {
        id: "x",
        name: '=SUM(1,2)".wav',
        size: 100,
        status: "done",
        result: {
          bpm: 120.123,
          confidence: 3.5,
          duration: 12,
          beats: [],
          waveform: [],
        },
      },
    ];
    expect(csvOf(tracks)).toContain(
      '"\'=SUM(1,2)"".wav",120.12,3.500,12.00,done',
    );
  });
  it("includes tail samples and short waveforms without out-of-bounds values", () => {
    expect(waveformOf(new Float32Array([0, -0.5, 1]), 2)).toEqual([0.5, 1]);
    expect(waveformOf(new Float32Array([0.3]), 100)).toHaveLength(1);
    expect(waveformOf(new Float32Array())).toEqual([]);
  });
});
