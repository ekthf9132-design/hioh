export type Level = 'IM1' | 'IM2' | 'IM3' | 'IH' | 'AL';

export interface AnswerRecord {
  id: string;
  date: string;
  answerText: string;
  level: Level;
  duration?: number;
  audioUrl?: string;
}

export interface Question {
  id: string;
  text: string;
  records: AnswerRecord[];
  nextReview?: string;
  reviewCount: number;
}

export interface VocabWord {
  id: string;
  word: string;
  meaning: string;
  partOfSpeech?: string;
  level?: string;
  from: string;
  date: string;
}

export interface StudyStreak {
  lastStudyDate: string;
  currentStreak: number;
  longestStreak: number;
}

export const LEVEL_CONFIG: Record<Level, { tips: string; color: string; bg: string; border: string; text: string }> = {
  IM1: { tips: '2~3문장 / 기본 시제 / 단순 연결어', color: 'blue', bg: 'bg-blue-950', border: 'border-blue-800', text: 'text-blue-400' },
  IM2: { tips: '4~5문장 / 예시 포함 / because, when 등', color: 'green', bg: 'bg-green-950', border: 'border-green-800', text: 'text-green-400' },
  IM3: { tips: '5~6문장 / 비교·대조 / 구체적 경험', color: 'amber', bg: 'bg-amber-950', border: 'border-amber-800', text: 'text-amber-400' },
  IH:  { tips: '6~8문장 / 논리 구조 / 고급 어휘', color: 'orange', bg: 'bg-orange-950', border: 'border-orange-800', text: 'text-orange-400' },
  AL:  { tips: '8문장+ / 관용어·숙어 / 복잡한 문장', color: 'purple', bg: 'bg-purple-950', border: 'border-purple-800', text: 'text-purple-400' },
};
