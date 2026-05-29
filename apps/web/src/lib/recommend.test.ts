import { describe, it, expect } from "vitest";
import { shuffle, interleave } from "./recommend";

describe("shuffle", () => {
  it("preserves length + membership", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect(out).toHaveLength(5);
    expect([...out].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });
  it("does not mutate the input array", () => {
    const input = [1, 2, 3];
    shuffle(input);
    expect(input).toEqual([1, 2, 3]);
  });
  it("handles empty + single", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([7])).toEqual([7]);
  });
});

describe("interleave — round-robin merge", () => {
  it("takes the i-th of each list in turn", () => {
    expect(
      interleave([
        ["a1", "a2", "a3"],
        ["b1", "b2"],
        ["c1"],
      ]),
    ).toEqual(["a1", "b1", "c1", "a2", "b2", "a3"]);
  });
  it("handles a single list", () => {
    expect(interleave([["x", "y", "z"]])).toEqual(["x", "y", "z"]);
  });
  it("handles empty lists in the mix", () => {
    expect(interleave([[], ["a"], []])).toEqual(["a"]);
  });
  it("handles no lists / all empty", () => {
    expect(interleave([])).toEqual([]);
    expect(interleave([[], []])).toEqual([]);
  });
  it("balances a slice across sources (no single-source dominance)", () => {
    const a = ["a1", "a2", "a3", "a4", "a5"];
    const b = ["b1", "b2", "b3", "b4", "b5"];
    const first4 = interleave([a, b]).slice(0, 4);
    // First 4 should be 2 from each, not 4 from one source.
    expect(first4.filter((x) => x.startsWith("a"))).toHaveLength(2);
    expect(first4.filter((x) => x.startsWith("b"))).toHaveLength(2);
  });
});
