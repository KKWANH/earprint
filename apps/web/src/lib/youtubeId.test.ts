import { describe, it, expect } from "vitest";
import { parseYouTubeVideoId } from "./youtubeId";

describe("parseYouTubeVideoId", () => {
  it("accepts a bare 11-char id", () => {
    expect(parseYouTubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("parses watch?v= URLs", () => {
    expect(
      parseYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });
  it("parses watch URL with extra params", () => {
    expect(
      parseYouTubeVideoId(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxx&t=42",
      ),
    ).toBe("dQw4w9WgXcQ");
  });
  it("parses youtu.be short links", () => {
    expect(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });
  it("parses /shorts/ URLs", () => {
    expect(
      parseYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });
  it("parses /embed/ URLs", () => {
    expect(
      parseYouTubeVideoId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });
  it("parses music.youtube.com", () => {
    expect(
      parseYouTubeVideoId("https://music.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });
  it("rejects non-youtube hosts", () => {
    expect(
      parseYouTubeVideoId("https://vimeo.com/watch?v=dQw4w9WgXcQ"),
    ).toBeNull();
  });
  it("rejects malformed ids (wrong length)", () => {
    expect(parseYouTubeVideoId("https://youtu.be/tooShort")).toBeNull();
    expect(parseYouTubeVideoId("notanid")).toBeNull();
  });
  it("rejects empty / garbage", () => {
    expect(parseYouTubeVideoId("")).toBeNull();
    expect(parseYouTubeVideoId("just some text")).toBeNull();
  });
  it("trims surrounding whitespace", () => {
    expect(parseYouTubeVideoId("  dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
  });
});
