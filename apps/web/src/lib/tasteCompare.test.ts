import { describe, it, expect } from "vitest";
import { compareTaste, type TasteVector } from "./tasteCompare";

const mk = (
  genres: string[],
  artists: string[],
  feel: TasteVector["audioFeel"] = null,
): TasteVector => ({
  genres: genres.map((name, i) => ({ name, count: 100 - i })),
  artists: artists.map((name, i) => ({ name, count: 100 - i })),
  audioFeel: feel,
});

describe("compareTaste", () => {
  it("identical taste → twin tier, score 1", () => {
    const v = mk(["pop", "rock", "jazz"], ["A", "B", "C"]);
    const r = compareTaste(v, v);
    expect(r.score).toBeCloseTo(1, 5);
    expect(r.tier).toBe("twin");
    expect(r.sharedArtists.sort()).toEqual(["a", "b", "c"]);
  });

  it("zero overlap → distant tier, score 0", () => {
    const a = mk(["pop"], ["A"]);
    const b = mk(["metal"], ["Z"]);
    const r = compareTaste(a, b);
    expect(r.score).toBe(0);
    expect(r.tier).toBe("distant");
    expect(r.sharedArtists).toEqual([]);
  });

  it("partial artist overlap surfaces shared names", () => {
    const a = mk(["pop", "rock"], ["A", "B", "C"]);
    const b = mk(["pop", "jazz"], ["B", "C", "D"]);
    const r = compareTaste(a, b);
    expect(r.sharedArtists.sort()).toEqual(["b", "c"]);
    expect(r.sharedGenres).toEqual(["pop"]);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(1);
  });

  it("case-insensitive matching", () => {
    const a = mk(["Pop"], ["Taylor Swift"]);
    const b = mk(["pop"], ["taylor swift"]);
    const r = compareTaste(a, b);
    expect(r.genreJaccard).toBe(1);
    expect(r.artistJaccard).toBe(1);
  });

  it("audio feel similarity null when one side missing", () => {
    const a = mk(["pop"], ["A"], { energy: 0.5, tempo: 0.5, acousticness: 0.5 });
    const b = mk(["pop"], ["A"], null);
    expect(compareTaste(a, b).feelSimilarity).toBeNull();
  });

  it("identical audio feel → similarity 1", () => {
    const f = { energy: 0.7, tempo: 0.6, acousticness: 0.3 };
    const a = mk(["pop"], ["A"], f);
    const b = mk(["pop"], ["A"], { ...f });
    expect(compareTaste(a, b).feelSimilarity).toBeCloseTo(1, 5);
  });

  it("opposite audio feel → low similarity", () => {
    const a = mk(["pop"], ["A"], { energy: 0, tempo: 0, acousticness: 0 });
    const b = mk(["pop"], ["A"], { energy: 1, tempo: 1, acousticness: 1 });
    expect(compareTaste(a, b).feelSimilarity).toBeLessThan(0.2);
  });

  it("empty vectors don't throw", () => {
    const empty = mk([], []);
    const r = compareTaste(empty, empty);
    expect(r.score).toBe(0);
    expect(r.tier).toBe("distant");
  });

  it("score ignores feel weight when feel absent (renormalizes)", () => {
    // Full artist + genre overlap, no feel → should still be 1.0,
    // not penalized for the missing 0.15 feel weight.
    const a = mk(["pop", "rock"], ["A", "B"]);
    const b = mk(["pop", "rock"], ["A", "B"]);
    expect(compareTaste(a, b).score).toBeCloseTo(1, 5);
  });
});
