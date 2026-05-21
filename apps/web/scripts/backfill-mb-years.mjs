/**
 * Backfills the *original* release year from MusicBrainz, per album.
 *
 * Deezer's release_date is the matched edition's date — for catalog music
 * usually a recent remaster — which corrupts the reminiscence-bump analysis.
 * A MusicBrainz "release group" is the version-agnostic album; its
 * `first-release-date` is the genuine original. Looking it up once per album
 * (then applying to all its tracks) is fast and far less noisy than per-track.
 *
 * Run:  pnpm --filter web backfill:years
 * MusicBrainz allows ~1 request/second.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";

neonConfig.webSocketConstructor = WebSocket;

const DB = process.env.DATABASE_URL;
if (!DB) {
  console.error("❌ DATABASE_URL 가 없습니다 (apps/web/.dev.vars).");
  process.exit(1);
}

const MB = "https://musicbrainz.org/ws/2";
const UA = "PlaylistAnalyzer/1.0 (https://music.kwanho.dev)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9가-힣]+/gi, "");

function cleanAlbum(album) {
  return String(album || "")
    .replace(
      /\s*[([][^()[\]]*\b(remaster(ed)?|deluxe|reissue|anniversary|expanded|edition|mono|stereo|version|bonus|special)\b[^()[\]]*[)\]]/gi,
      "",
    )
    .replace(/\s*[-–]\s*\d{4}\b.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function mbAlbumYear(artist, album) {
  const ca = cleanAlbum(album) || album;
  const query = `releasegroup:"${ca.replace(/"/g, "")}" AND artist:"${String(artist).replace(/"/g, "")}"`;
  try {
    const res = await fetch(
      `${MB}/release-group?query=${encodeURIComponent(query)}&fmt=json&limit=10`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) return { ok: false, year: null };
    const data = await res.json();
    const target = normKey(ca);
    const now = new Date().getFullYear() + 1;
    let exact = null;
    let anyMain = null;
    for (const rg of data?.["release-groups"] ?? []) {
      const m = /^(\d{4})/.exec(rg["first-release-date"] ?? "");
      if (!m) continue;
      const y = Number(m[1]);
      if (y < 1900 || y > now) continue;
      if (normKey(rg.title) === target && (exact === null || y < exact)) exact = y;
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

const pool = new Pool({ connectionString: DB });
const q = (text, params) => pool.query(text, params);

try {
  console.log("🎵 MusicBrainz 원곡 발매연도 보강 (앨범 단위, 1초/요청)\n");
  let albums = 0;
  let tracks = 0;
  let stall = 0;
  for (;;) {
    const { rows } = await q(
      `SELECT t.artist, t.album, array_agg(t.id) AS ids
       FROM tracks t JOIN user_tracks ut ON ut.track_id = t.id
       WHERE t.release_year IS NULL AND t.album IS NOT NULL AND t.album <> ''
       GROUP BY t.artist, t.album
       LIMIT 12`,
    );
    if (rows.length === 0) break;
    const out = [];
    for (const g of rows) {
      const r = await mbAlbumYear(g.artist, g.album);
      if (r.ok) {
        for (const id of g.ids) out.push({ trackId: id, releaseYear: r.year ?? 0, rank: null });
        albums++;
        if (r.year) tracks += g.ids.length;
      }
      await sleep(1100);
    }
    if (out.length > 0) {
      await q("SELECT save_track_meta($1::jsonb)", [JSON.stringify(out)]);
      stall = 0;
    } else if (++stall >= 5) {
      console.log("\n⚠ MusicBrainz 응답이 계속 실패해 중단합니다 (재실행하면 이어집니다).");
      break;
    } else {
      await sleep(5000);
    }
    process.stdout.write(`\r  앨범 ${albums}개 조회 · 연도 확인 ${tracks}곡`);
  }
  console.log(`\n✅ 완료 — 앨범 ${albums}개, ${tracks}곡 원곡 연도 확보.`);
} catch (err) {
  console.error("❌ 실패:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
