import { describe, it, expect } from "vitest";
import {
  findGenre,
  genreFamily,
  canonicalGenreKey,
  canonicalGenreLabel,
  genreMatchKeys,
  genreFamilyLabel,
  listSubGenres,
  listFamilies,
  isExcludedGenre,
} from "./genreDict";

describe("findGenre — alias resolution", () => {
  it("resolves exact label", () => {
    expect(findGenre("Synth-Pop")?.id).toBe("synth_pop");
  });
  it("merges spelling variants to one canonical id", () => {
    const ids = ["synthpop", "synth-pop", "Synth Pop", "SYNTH_POP"].map(
      (s) => findGenre(s)?.id,
    );
    expect(new Set(ids)).toEqual(new Set(["synth_pop"]));
  });
  it("resolves korean indie variants", () => {
    for (const s of ["k-indie", "k indie", "korean indie", "K-Indie"]) {
      expect(findGenre(s)?.id).toBe("korean_indie");
    }
  });
  it("returns null for gibberish", () => {
    expect(findGenre("zzqqww nonsense 12345")).toBeNull();
  });
  it("returns null for empty / whitespace", () => {
    expect(findGenre("")).toBeNull();
    expect(findGenre("   ")).toBeNull();
  });
});

describe("R37 additions resolve", () => {
  it.each([
    ["pop rock", "pop_rock"],
    ["pop-rock", "pop_rock"],
    ["soft rock", "soft_rock"],
    ["instrumental", "instrumental"],
    ["piano solo", "piano"],
  ])("%s → %s", (input, expectedId) => {
    expect(findGenre(input)?.id).toBe(expectedId);
  });
});

describe("aliases that resolve to pre-existing canonical (not dead nodes)", () => {
  it.each([
    "arena rock",
    "contemporary r&b",
    "ost",
    "film score",
    "acoustic pop",
    "modern rock",
  ])(
    "%s resolves to a canonical genre",
    (input) => {
      expect(findGenre(input)).not.toBeNull();
    },
  );
});

describe("no duplicate ids / no shadowed new entries", () => {
  it("every sub-genre id is unique", () => {
    const ids = listSubGenres().map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("pop rock now lands on pop_rock not power_pop (alias conflict fix)", () => {
    expect(findGenre("pop rock")?.id).toBe("pop_rock");
  });
  it("soft rock now lands on soft_rock not soft_pop", () => {
    expect(findGenre("soft rock")?.id).toBe("soft_rock");
  });
});

describe("canonicalGenreLabel / canonicalGenreKey", () => {
  it("returns canonical label for known variants", () => {
    expect(canonicalGenreLabel("synthpop")).toBe("Synth-Pop");
    expect(canonicalGenreLabel("k-indie")).toBe("Korean Indie");
  });
  it("title-cases genuinely-unknown input as fallback", () => {
    // Use a string with no substring overlap with any known alias.
    expect(canonicalGenreLabel("qqzz wibble")).toBe("Qqzz Wibble");
  });
  it("collapses variants to one key", () => {
    expect(canonicalGenreKey("synthpop")).toBe(canonicalGenreKey("synth-pop"));
  });
  it("unknown key falls back to lowercased trimmed input", () => {
    expect(canonicalGenreKey("  Weird Tag  ")).toBe("weird tag");
  });
});

describe("genreMatchKeys — alias key set for SQL matching", () => {
  it("returns all normalized variants for a known genre", () => {
    const keys = genreMatchKeys("Synth-Pop");
    // Should contain the normalized aliases: synth pop, synthpop→
    // 'synthpop' normalises to 'synthpop'... actually normalise
    // collapses dashes so 'synth-pop' → 'synth pop'. 'synthpop'
    // (no separator) stays 'synthpop'.
    expect(keys).toContain("synth pop");
    expect(keys).toContain("synthpop");
  });
  it("non-empty single key for unknown genre", () => {
    expect(genreMatchKeys("my weird genre")).toEqual(["my weird genre"]);
  });
  it("empty for blank input", () => {
    expect(genreMatchKeys("   ")).toEqual([]);
  });
});

describe("genreFamily / genreFamilyLabel", () => {
  it("maps sub-genre to family id", () => {
    expect(genreFamily("synth-pop")).toBe("pop");
    expect(genreFamily("trap")).toBe("hiphop");
  });
  it("localized family label", () => {
    expect(genreFamilyLabel("synth-pop", "en")?.label).toBe("Pop");
    expect(genreFamilyLabel("synth-pop", "ko")?.label).toBe("팝");
  });
  it("null family for unknown", () => {
    expect(genreFamilyLabel("zzz unknown", "en")).toBeNull();
  });
});

describe("family integrity", () => {
  it("every sub-genre points to a real family", () => {
    const familyIds = new Set(listFamilies().map((f) => f.id));
    for (const g of listSubGenres()) {
      expect(familyIds.has(g.family)).toBe(true);
    }
  });
});

describe("isExcludedGenre", () => {
  it("does not flag normal genres", () => {
    expect(isExcludedGenre("synth-pop")).toBe(false);
    expect(isExcludedGenre("trap")).toBe(false);
  });
  it("returns false for unknown genres", () => {
    expect(isExcludedGenre("qqzz wibble")).toBe(false);
  });
});
