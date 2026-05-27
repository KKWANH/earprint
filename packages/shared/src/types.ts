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

/** Telemetry from the extension's scrape pass so the server can judge
 *  whether the captured list is a faithful snapshot of the user's
 *  YouTube Music Liked Music page or a partial sample. */
export interface SyncDiagnostics {
  /** Total count parsed from the playlist header ("2,353곡 · ..."). null
   *  when the header wasn't readable (older YT Music UI, language mismatch). */
  expected: number | null;
  /** How many distinct tracks the extension collected this run. */
  captured: number;
  /** True when the scroller hit the end of the rendered list cleanly
   *  (saw the trailing sentinel, no spinner stuck). The single most
   *  load-bearing flag — the server uses it to decide whether deletes
   *  are allowed in the same transaction as the upserts. */
  endedClean: boolean;
  /** Peak DOM row count seen during the scrape — lets us spot the case
   *  where YT Music virtualises older rows out of the DOM mid-scroll. */
  domPeak?: number;
  /** Last loading spinner observed — true means the page was still
   *  fetching more rows when the scrape gave up. */
  spinnerSeen?: boolean;
  /** Title of the last captured row, for log-only "we got up to X". */
  lastTitle?: string | null;
}

/** Extension → backend sync payload. */
export interface SyncRequest {
  source: "ytmusic";
  tracks: CapturedTrack[];
  /**
   * True ONLY when the extension is confident the captured list is the
   * full liked-music library. When false / missing, the server treats
   * the upload as an append-only refresh — it inserts new tracks and
   * touches list_position, but never deletes tracks the user still has
   * liked but that didn't appear this round.
   *
   * Default-false-on-missing is intentional: older extension builds
   * predate this field, and the safe interpretation is "may be partial".
   * The 20-track threshold previously used as a proxy was unsafe — a
   * legitimate small library wouldn't get the replace-mode behaviour it
   * needed, and a large library that scrolled to 50 tracks before
   * stalling would silently wipe everything from 51 onward.
   */
  complete?: boolean;
  /** Optional telemetry — strictly for server-side decisioning + logs;
   *  never displayed to other users. */
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
