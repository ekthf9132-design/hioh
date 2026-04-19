'use client';
import { useStorage } from '../hooks/useStorage';
import { StudyStreak } from '../types';

export default function Streak() {
  const [streak] = useStorage<StudyStreak>('hioh_streak', {
    lastStudyDate: '',
    currentStreak: 0,
    longestStreak: 0,
  });

  return (
    <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
      <div className="text-2xl">🔥</div>
      <div>
        <div className="text-sm font-medium text-white">{streak.currentStreak}일 연속</div>
        <div className="text-xs text-zinc-500">최장 {streak.longestStreak}일</div>
      </div>
    </div>
  );
}
