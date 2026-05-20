/**
 * 앱 · 확장 · (참고용) 분석 서비스가 공유하는 도메인 타입.
 * db/schema.sql 과 1:1 로 대응한다.
 */

/** label -> probability(0..1) 분포 맵. genres/moods/instruments 등에 사용. */
export type LabelDistribution = Record<string, number>;

export type MusicScale = "major" | "minor";
export type VoiceInstrumental = "voice" | "instrumental";
export type AnalysisJobStatus = "pending" | "running" | "done" | "failed";

/** 확장이 music.youtube.com 에서 수집해 백엔드로 보내는 원본 항목. */
export interface CapturedTrack {
  /** YouTube Music videoId */
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  /** 플랫폼상 좋아요 시각 (ISO 8601) — 알 수 있을 때만 */
  likedAt?: string;
}

/** 확장 → 백엔드 동기화 페이로드. */
export interface SyncRequest {
  source: "ytmusic";
  tracks: CapturedTrack[];
}

/** 전역 공유 canonical 트랙. */
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

/** 트랙별 특성 분석 결과. */
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
  /** 필드별 신뢰도(0..1) */
  confidence: Record<string, number> | null;
  /** 필드별 출처: 'api' | 'model' */
  sourceFlags: Record<string, string> | null;
}

/** 사용자별 집계 취향 프로필 (추천 / 미래 작곡 conditioning). */
export interface TasteProfile {
  userId: string;
  genreDist: LabelDistribution | null;
  moodDist: LabelDistribution | null;
  bpmHistogram: Record<string, number> | null;
  keyDist: LabelDistribution | null;
  trackCount: number;
}
