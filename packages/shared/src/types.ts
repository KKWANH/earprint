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
}

/** Extension → backend sync payload. */
export interface SyncRequest {
  source: "ytmusic";
  tracks: CapturedTrack[];
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
