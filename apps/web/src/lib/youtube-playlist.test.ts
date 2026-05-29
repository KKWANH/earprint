import { describe, it, expect } from "vitest";
import { extractPlaylistId, isPrivatePlaylistId } from "./youtube-playlist";

describe("extractPlaylistId", () => {
  it("parses /playlist?list= URLs", () => {
    expect(
      extractPlaylistId("https://www.youtube.com/playlist?list=PLabc123def456"),
    ).toBe("PLabc123def456");
  });
  it("parses watch URL with &list=", () => {
    expect(
      extractPlaylistId(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc123def456",
      ),
    ).toBe("PLabc123def456");
  });
  it("parses music.youtube.com playlists", () => {
    expect(
      extractPlaylistId("https://music.youtube.com/playlist?list=PLabc123def456"),
    ).toBe("PLabc123def456");
  });
  it("accepts a bare playlist id", () => {
    expect(extractPlaylistId("PLabc123def456ghi")).toBe("PLabc123def456ghi");
  });
  it("rejects non-youtube hosts", () => {
    expect(
      extractPlaylistId("https://example.com/playlist?list=PLabc123def456"),
    ).toBeNull();
  });
  it("rejects URLs without a list param", () => {
    expect(
      extractPlaylistId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBeNull();
  });
  it("rejects empty / garbage", () => {
    expect(extractPlaylistId("")).toBeNull();
    expect(extractPlaylistId("not a url")).toBeNull();
  });
});

describe("isPrivatePlaylistId", () => {
  it("flags LM (Liked Music) and WL (Watch Later)", () => {
    expect(isPrivatePlaylistId("LM")).toBe(true);
    expect(isPrivatePlaylistId("WL")).toBe(true);
  });
  it("does not flag normal playlist ids", () => {
    expect(isPrivatePlaylistId("PLabc123def456")).toBe(false);
  });
});
