export interface Question {
  id: string;
  text: string;
  level: Level;
  createdAt: string;
}

export interface Answer {
  id: string;
  questionId: string;
  questionText: string;
  answerText: string;
  level: Level;
  date: string;
  nextReview?: string;
  reviewCount: number;
}

export interface VocabWord {
  id: string;
  word: string;
  meaning: string;
  from: string;
  date: string;
}

export interface StudyStreak {
  lastStudyDate: string;
  currentStreak: number;
  longestStreak: number;
}

export type Level = 'IM1' | 'IM2' | 'IM3' | 'IH' | 'AL';

export const LEVEL_CONFIG: Record<Level, { desc: string; tips: string; color: string }> = {
  IM1: { desc: '익숙한 주제에 대해 간단한 문장으로 답변. 2~3문장 목표.', tips: '2~3문장 / 기본 시제 / 단순 연결어 (and, but, so)', color: 'blue' },
  IM2: { desc: '구체적인 예시를 포함한 4~5문장. 다양한 시제와 연결어 활용.', tips: '4~5문장 / 예시 1개 이상 / because, when, although 등', color: 'green' },
  IM3: { desc: '자세한 설명과 비교·대조 포함. 5~6문장. 어휘 다양성.', tips: '5~6문장 / 비교·대조 (compared to) / 구체적 경험', color: 'amber' },
  IH:  { desc: '복잡한 주제도 논리적으로 전개. 6~8문장. 고급 어휘.', tips: '6~8문장 / 논리 구조 (서론-본론-결론) / 고급 어휘', color: 'orange' },
  AL:  { desc: '원어민 수준. 8문장 이상. 관용어, 뉘앙스, 풍부한 어휘.', tips: '8문장 이상 / 관용어·숙어 / 복잡한 문장 구조', color: 'purple' },
};
