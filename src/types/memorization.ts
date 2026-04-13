export type ConfidenceRating = 'easy' | 'shaky' | 'hard';

export type MemorizationStage = 
  | 'listen' 
  | 'hide-third' 
  | 'hide-half' 
  | 'first-letters' 
  | 'full-hide' 
  | 'self-assess';

export type SessionPhase = 'setup' | 'memorizing' | 'checkpoint' | 'summary';

export interface MemorizationSessionConfig {
  surahId: number;
  surahName: string;
  ayahStart: number;
  ayahEnd: number;
  repetitions: number;
  chunkSize: number;
  showTranslation: boolean;
  showTransliteration: boolean;
}

export interface AyahPerformance {
  ayahNumber: number;
  confidenceRating: ConfidenceRating | null;
  reviewScheduledFor: string[];
  markedWeak: boolean;
  repetitionsCompleted: number;
}

export interface ChunkProgress {
  chunkIndex: number;
  ayahStart: number;
  ayahEnd: number;
  completed: boolean;
  needsRepeat: boolean;
}

export interface MemorizationSessionState {
  config: MemorizationSessionConfig;
  phase: SessionPhase;
  currentChunkIndex: number;
  currentAyahInChunk: number;
  currentStage: MemorizationStage;
  currentRepetition: number;
  ayahPerformance: Record<number, AyahPerformance>;
  chunks: ChunkProgress[];
  startedAt: string;
  completedAt: string | null;
  totalTimeSpentMs: number;
}

export interface PlaceholderAyah {
  number: number;
  text: string;
  translation: string;
  transliteration: string;
  words: string[];
}

export interface PlaceholderSurah {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
  ayahs: PlaceholderAyah[];
}
