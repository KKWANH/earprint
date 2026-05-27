/**
 * Domain types shared by the web app, the extension, and (for reference)
 * the analysis service. Maps 1:1 to db/schema.sql.
 */

/** label -> probability(0..1) distribution map. Used for genres/moods/instruments. */
export type LabelDistribution = Record<string, number>;

export type MusicScale = "major" | "minor";
export type VoiceInstrumental = "voice" | "instrumental";
export type AnalysisJobStatus = "pending" | "running" | "done" | "failed";

/** A raw item the extension collects on music.youtube.com and sends to the backend. */
export interface CapturedTrack {
  /** YouTube Music videoId */
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  /** Like time on the platform (ISO 8601) — only when known */
  likedAt?: string;
  /** Zero-based index in the user's Liked Music list at capture time.
   *  YouTube serves the LM playlist newest-first, so position 0 is the
   *  most recently liked song. The backend uses this to weight recent
   *  likes higher in the taste profile (current taste != all-time taste).
   *  Optional because the field is new — older extension builds and
   *  parser fallbacks may omit it. */
  position?: number;
}

/** Telemetry from the extension's scrape pass — purely informational
 *  now that sync is append-only. The server stores `expected` and
 *  `captured` on users.last_sync_* so /connect can render a "last sync:
 *  1,417 captured (header said 1,420)" line. None of these gate any
 *  destructive action. */
export interface SyncDiagnostics {
  /** Total count parsed from the playlist header ("2,353곡 · ..."). null
   *  when the header wasn't readable (older YT Music UI, language mismatch). */
  expected: number | null;
  /** How many distinct tracks the extension collected this run. */
  captured: number;
  /** True when the scroller hit the end of the rendered list cleanly
   *  (saw the trailing sentinel, no spinner stuck). Informational. */
  endedClean: boolean;
  /** Peak DOM row count seen during the scrape — lets us spot the case
   *  where YT Music virtualises older rows out of the DOM mid-scroll. */
  domPeak?: number;
  /** Last loading spinner observed — true means the page was still
   *  fetching more rows when the scrape gave up. */
  spinnerSeen?: boolean;
  /** Title of the last captured row, for log-only "we got up to X". */
  lastTitle?: string | null;
  /** True when the user manually stopped the scrape via the popup's
   *  "Stop now" button. Distinguishes "I'm done, save what we have"
   *  from a stall / crash. */
  manualStop?: boolean;
}

/** Extension → backend sync payload.
 *
 * Earprint sync is APPEND-ONLY. Every upload inserts new tracks and
 * refreshes list_position on existing ones; nothing is ever deleted
 * server-side in response to a sync, even if the user has un-liked the
 * song on YouTube Music. Earprint is a permanent history of "everything
 * you've ever liked" — users wanting to drop a track from stats use the
 * per-artist Exclude controls on /library, which filter from aggregates
 * without touching the underlying user_tracks row.
 *
 * The earlier `complete` flag (which permitted a destructive
 * replace-mode delete) was removed: a scrape that stalled mid-list and
 * then asserted complete=true silently destroyed thousands of liked
 * tracks, and the upside (auto-clearing un-liked songs) was not worth
 * that failure mode.
 */
export interface SyncRequest {
  source: "ytmusic";
  tracks: CapturedTrack[];
  /** Optional telemetry — strictly for server-side metrics + logs;
   *  never displayed to other users and never gates a delete. */
  diagnostics?: SyncDiagnostics;
}

/** Globally shared canonical track. */
export interface Track {
  id: string;
  mbid: string | null;
  title: string;
  artist: string;
  album: string | null;
  durationMs: number | null;
  isrc: string | null;
  deezerId: number | null;
  resolved: boolean;
  matchConfidence: number | null;
}

/** Per-track feature analysis result. */
export interface Analysis {
  id: string;
  trackId: string;
  analysisVersion: number;
  bpm: number | null;
  musicKey: string | null;
  musicScale: MusicScale | null;
  timeSignature: string | null;
  genres: LabelDistribution | null;
  moods: LabelDistribution | null;
  instruments: LabelDistribution | null;
  danceability: number | null;
  valence: number | null;
  arousal: number | null;
  voiceInstrumental: VoiceInstrumental | null;
  /** Per-field confidence (0..1) */
  confidence: Record<string, number> | null;
  /** Per-field source: 'api' | 'model' */
  sourceFlags: Record<string, string> | null;
}

/** Per-user aggregated taste profile (recommendations / future composition conditioning). */
export interface TasteProfile {
  userId: string;
  genreDist: LabelDistribution | null;
  moodDist: LabelDistribution | null;
  bpmHistogram: Record<string, number> | null;
  keyDist: LabelDistribution | null;
  trackCount: number;
}
