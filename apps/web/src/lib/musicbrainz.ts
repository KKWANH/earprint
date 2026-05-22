/**
 * MusicBrainz — the *original* release year of an album.
 *
 * Deezer's release_date is the matched edition's date, which for catalog music
 * is a recent remaster/reissue (Queen "Bohemian Rhapsody" → 2011). MusicBrainz
 * models an album as a version-agnostic "release group" whose
 * `first-release-date` is the genuine original — exactly what the
 * reminiscence-bump analysis needs. Looking it up per album (not per track)
 * is both far fewer requests and much less noisy than recording search.
 *
 * Free, no key, rate-limited to ~1 request/second — callers must space out.
 */
const MB = "https://musicbrainz.org/ws/2";
const UA = "Earprint/1.0 (https://earprint.kwanho.dev)";

/** Strips reissue / edition markers so the album matches its release group. */
export function cleanAlbum(album: string): string {
  return album
    .replace(
      /\s*[([][^()[\]]*\b(remaster(ed)?|deluxe|reissue|anniversary|expanded|edition|mono|stereo|version|bonus|special)\b[^()[\]]*[)\]]/gi,
      "",
    )
    .replace(/\s*[-–]\s*\d{4}\b.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]+/gi, "");

export interface MbYear {
  ok: boolean; // false = fetch failed (retry); true = MB answered
  year: number | null; // null = answered but nothing usable
}

/** Original release year for an artist's album via the MusicBrainz release group. */
export async function mbAlbumYear(artist: string, album: string): Promise<MbYear> {
  const ca = cleanAlbum(album) || album;
  const query = `releasegroup:"${ca.replace(/"/g, "")}" AND artist:"${artist.replace(/"/g, "")}"`;
  try {
    const res = await fetch(
      `${MB}/release-group?query=${encodeURIComponent(query)}&fmt=json&limit=10`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) return { ok: false, year: null };
    const data = (await res.json()) as {
      "release-groups"?: {
        title?: string;
        "first-release-date"?: string;
        "primary-type"?: string;
      }[];
    };
    const target = normKey(ca);
    const now = new Date().getFullYear() + 1;
    let exact: number | null = null; // earliest with a title that matches
    let anyMain: number | null = null; // earliest album/EP/single, as a fallback
    for (const rg of data["release-groups"] ?? []) {
      const m = /^(\d{4})/.exec(rg["first-release-date"] ?? "");
      if (!m) continue;
      const y = Number(m[1]);
      if (y < 1900 || y > now) continue;
      if (normKey(rg.title ?? "") === target && (exact === null || y < exact)) exact = y;
      if (
        ["Album", "EP", "Single"].includes(rg["primary-type"] ?? "") &&
        (anyMain === null || y < anyMain)
      ) {
        anyMain = y;
      }
    }
    return { ok: true, year: exact ?? anyMain };
  } catch {
    return { ok: false, year: null };
  }
}
