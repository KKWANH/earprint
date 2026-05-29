import { describe, it, expect } from "vitest";
import { norm, scoreMatch } from "./deezer";

describe("norm — track string normalization", () => {
  it("lowercases", () => {
    expect(norm("Bohemian Rhapsody")).toBe("bohemian rhapsody");
  });
  it("strips parenthetical / bracket content", () => {
    expect(norm("Song (Remastered 2011)")).toBe("song");
    expect(norm("Song [Live]")).toBe("song");
  });
  it("strips feat. suffix", () => {
    expect(norm("Track feat. Someone")).toBe("track");
    expect(norm("Track ft Another")).toContain("track");
  });
  it("keeps CJK characters", () => {
    expect(norm("밤편지")).toBe("밤편지");
    expect(norm("夜に駆ける")).toBe("夜に駆ける");
  });
  it("collapses symbols to spaces", () => {
    expect(norm("R&B / Soul!")).toBe("r b soul");
  });
});

describe("scoreMatch", () => {
  it("exact match scores highest", () => {
    expect(scoreMatch("Bohemian Rhapsody", "bohemian rhapsody")).toBe(0.95);
  });
  it("remaster variant is a strong substring match (0.75)", () => {
    // deezer.norm only strips (parens)/[brackets]/feat — NOT the
    // ' - Remastered' dash suffix (that's track_canon_key's job).
    // So this resolves to a substring match, not exact.
    expect(
      scoreMatch("Bohemian Rhapsody", "Bohemian Rhapsody - Remastered 2011"),
    ).toBe(0.75);
  });
  it("parenthetical remaster DOES match exactly (norm strips it)", () => {
    expect(
      scoreMatch("Bohemian Rhapsody", "Bohemian Rhapsody (Remastered 2011)"),
    ).toBe(0.95);
  });
  it("substring match scores 0.75", () => {
    expect(scoreMatch("Love", "Love Story")).toBe(0.75);
  });
  it("unrelated scores 0.5", () => {
    expect(scoreMatch("Apple", "Banana")).toBe(0.5);
  });
  it("empty after norm scores 0.4", () => {
    expect(scoreMatch("(Live)", "Real Song")).toBe(0.4);
  });
});
