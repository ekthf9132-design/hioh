'use client';
import { useState, useRef, useEffect } from 'react';
import { useStorage } from './hooks/useStorage';
import { Answer, VocabWord, StudyStreak, Level, LEVEL_CONFIG } from './types';
import Timer from './components/Timer';
import Streak from './components/Streak';

type Tab = 'practice' | 'review' | 'vocab';

export default function Home() {
  const [tab, setTab] = useState<Tab>('practice');
  const [level, setLevel] = useState<Level>('IM1');
  const [pasteText, setPasteText] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useStorage<Answer[]>('hioh_answers', []);
  const [vocab, setVocab] = useStorage<VocabWord[]>('hioh_vocab', []);
  const [streak, setStreak] = useStorage<StudyStreak>('hioh_streak', { lastStudyDate: '', currentStreak: 0, longestStreak: 0 });
  const [activeRec, setActiveRec] = useState<number | null>(null);
  const [activeTTS, setActiveTTS] = useState<string | null>(null);
  const [ansInputs, setAnsInputs] = useState<Record<number, string>>({});
  const [tooltip, setTooltip] = useState<{ word: string; x: number; y: number } | null>(null);
  const recognitionRef = useRef<any>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const LEVELS: Level[] = ['IM1', 'IM2', 'IM3', 'IH', 'AL'];
  const LEVEL_COLORS: Record<Level, string> = {
    IM1: 'bg-blue-950 text-blue-400 border-blue-800',
    IM2: 'bg-green-950 text-green-400 border-green-800',
    IM3: 'bg-amber-950 text-amber-400 border-amber-800',
    IH:  'bg-orange-950 text-orange-400 border-orange-800',
    AL:  'bg-purple-950 text-purple-400 border-purple-800',
  };

  const updateStreak = () => {
    const today = new Date().toDateString();
    setStreak(prev => {
      if (prev.lastStudyDate === today) return prev;
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const newStreak = prev.lastStudyDate === yesterday ? prev.currentStreak + 1 : 1;
      return { lastStudyDate: today, currentStreak: newStreak, longestStreak: Math.max(newStreak, prev.longestStreak) };
    });
  };

  const parseQuestions = () => {
    if (!pasteText.trim()) return alert('질문을 먼저 붙여넣어주세요.');
    const lines = pasteText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed: string[] = [];
    lines.forEach(line => {
      const m = line.match(/^[\d]+[.)]\s*(.+)/);
      if (m) parsed.push(m[1].trim());
      else if (line.length > 20) parsed.push(line);
    });
    if (!parsed.length) return alert('질문을 찾지 못했어요.\n1. 2. 3. 형식으로 입력해주세요.');
    setQuestions(parsed);
    setAnsInputs({});
    setPasteText('');
  };

  const saveAnswer = (idx: number) => {
    const text = ansInputs[idx]?.trim();
    if (!text) return alert('답변을 입력하거나 말해보세요.');
    const today = new Date();
    const review3 = new Date(Date.now() + 3 * 86400000).toISOString();
    const record: Answer = {
      id: Date.now().toString(),
      questionId: idx.toString(),
      questionText: questions[idx],
      answerText: text,
      level,
      date: today.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' }),
      nextReview: review3,
      reviewCount: 0,
    };
    setAnswers(prev => [record, ...prev]);
    updateStreak();
    setAnsInputs(prev => ({ ...prev, [idx]: '' }));
    alert('저장됐어요! 3일 후 복습 알림이 예정됐어요.');
  };

  const playTTS = (text: string, id: string) => {
    if (!text.trim()) return;
    if (activeTTS) {
      window.speechSynthesis.cancel();
      setActiveTTS(null);
      if (activeTTS === id) return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.88;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => v.lang.startsWith('en-US')) || voices.find(v => v.lang.startsWith('en'));
    if (v) u.voice = v;
    setActiveTTS(id);
    u.onend = () => setActiveTTS(null);
    window.speechSynthesis.speak(u);
  };

  const toggleMic = (idx: number) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return alert('HTTPS 환경의 크롬에서 사용 가능해요.');
    if (activeRec === idx) {
      recognitionRef.current?.stop();
      setActiveRec(null); return;
    }
    if (activeRec !== null) recognitionRef.current?.stop();
    const rec = new SR();
    rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = true;
    rec.maxAlternatives = 1;
    let final = ansInputs[idx] ? ansInputs[idx].trim() + ' ' : '';
    rec.onresult = (ev: any) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      setAnsInputs(prev => ({ ...prev, [idx]: final + interim }));
    };
    rec.onend = () => { setAnsInputs(prev => ({ ...prev, [idx]: final.trim() })); setActiveRec(null); };
    rec.onerror = (e: any) => {
      setActiveRec(null);
      if (e.error === 'not-allowed') alert('마이크 권한을 허용해주세요.');
    };
    rec.start();
    recognitionRef.current = rec;
    setActiveRec(idx);
  };

  const reviewDue = answers.filter(a => a.nextReview && new Date(a.nextReview) <= new Date());

  const markReviewed = (id: string) => {
    setAnswers(prev => prev.map(a => {
      if (a.id !== id) return a;
      const days = a.reviewCount === 0 ? 7 : 14;
      return { ...a, reviewCount: a.reviewCount + 1, nextReview: new Date(Date.now() + days * 86400000).toISOString() };
    }));
    updateStreak();
  };

  const deleteAnswer = (id: string) => {
    if (!confirm('삭제할까요?')) return;
    setAnswers(prev => prev.filter(a => a.id !== id));
  };

  const saveVocab = (word: string) => {
    if (vocab.some(v => v.word.toLowerCase() === word.toLowerCase())) { setTooltip(null); return; }
    setVocab(prev => [...prev, { id: Date.now().toString(), word, meaning: '(사전 검색)', from: '질문지', date: new Date().toLocaleDateString('ko-KR') }]);
    setTooltip(null);
  };

  const handleWordPress = (e: React.TouchEvent | React.MouseEvent, word: string) => {
    pressTimer.current = setTimeout(() => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setTooltip({ word, x: rect.left, y: rect.bottom + window.scrollY + 6 });
    }, 600);
  };

  const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  const completed = new Set(answers.map(a => a.questionText));
  const progress = questions.length ? Math.round(completed.size / questions.length * 100) : 0;

  return (
    <div className="min-h-dvh bg-black text-white font-sans" onClick={() => setTooltip(null)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-safe pb-3 border-b border-zinc-900 sticky top-0 bg-black z-10">
        <span className="font-mono text-green-400 text-sm tracking-wide">hioh</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-green-400 bg-green-950 border border-green-800 px-3 py-1 rounded-full">
            🔥 {streak.currentStreak}일
          </span>
          <span className="text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-full">
            {answers.filter(a=>a.questionText && questions.includes(a.questionText)).length} / {questions.length}
          </span>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-zinc-900">
        {(['practice','review','vocab'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm transition-all ${tab === t ? 'text-green-400 border-b-2 border-green-400' : 'text-zinc-500'}`}>
            {t === 'practice' ? '연습' : t === 'review' ? `복습${reviewDue.length > 0 ? ` (${reviewDue.length})` : ''}` : `단어장${vocab.length > 0 ? ` (${vocab.length})` : ''}`}
          </button>
        ))}
      </div>

      <div className="px-4 pb-24 pt-4">

        {/* 연습 탭 */}
        {tab === 'practice' && (
          <div className="space-y-4">
            {/* 등급 선택 */}
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-2">목표 등급</div>
              <div className="flex gap-2 flex-wrap">
                {LEVELS.map(l => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-all ${level === l ? LEVEL_COLORS[l] : 'bg-zinc-900 border-zinc-700 text-zinc-400'}`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 leading-relaxed">
                {LEVEL_CONFIG[level].tips}
              </div>
            </div>

            {/* 텍스트 입력 */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="text-xs text-zinc-400 mb-2">질문 텍스트 붙여넣기</div>
              <textarea
                className="w-full bg-zinc-800 text-sm text-white rounded-lg p-3 resize-none min-h-24 placeholder-zinc-600 focus:outline-none focus:border-green-800 border border-zinc-700"
                placeholder={"1. Explain how technology affects our lives.\n2. What is your favorite hobby?\n3. Describe your hometown."}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
              />
              <button onClick={parseQuestions}
                className="w-full mt-2 py-3 bg-green-950 border border-green-800 text-green-400 text-sm font-medium rounded-lg">
                질문 카드 생성 →
              </button>
            </div>

            {/* 진행률 */}
            {questions.length > 0 && (
              <div>
                <div className="flex justify-between text-xs text-zinc-500 mb-1">
                  <span>진행률</span><span>{progress}%</span>
                </div>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-1 bg-green-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* 질문 카드 */}
            <div className="space-y-3">
              {questions.map((q, i) => {
                const isDone = completed.has(q);
                const savedAns = answers.find(a => a.questionText === q);
                return (
                  <div key={i} className={`bg-zinc-900 border rounded-xl overflow-hidden ${isDone ? 'border-green-900' : 'border-zinc-800'}`}>
                    <div className="p-4 pb-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-green-400 bg-green-950 border border-green-900 px-2 py-0.5 rounded-full">Q{i+1}</span>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${LEVEL_COLORS[level]}`}>{level}</span>
                        {isDone && <span className="text-xs text-green-400">✓ 완료</span>}
                      </div>
                      <div className="text-sm text-white leading-relaxed mb-3">{q}</div>
                    </div>

                    {/* 힌트 */}
                    <div className={`mx-4 mb-3 px-3 py-2 rounded-lg text-xs leading-relaxed border-l-2 ${
                      level==='IM1'?'bg-blue-950 border-blue-600 text-blue-300':
                      level==='IM2'?'bg-green-950 border-green-600 text-green-300':
                      level==='IM3'?'bg-amber-950 border-amber-600 text-amber-300':
                      level==='IH'?'bg-orange-950 border-orange-600 text-orange-300':
                      'bg-purple-950 border-purple-600 text-purple-300'}`}>
                      {LEVEL_CONFIG[level].tips}
                    </div>

                    {/* 저장된 답변 */}
                    {isDone && savedAns && (
                      <div className="mx-4 mb-3 bg-zinc-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-zinc-500 font-mono uppercase">저장된 답변</span>
                          <button onClick={() => playTTS(savedAns.answerText, `saved-${i}`)}
                            className={`text-xs px-2 py-1 rounded-md border flex items-center gap-1 ${activeTTS===`saved-${i}`?'bg-green-950 border-green-800 text-green-400':'bg-zinc-700 border-zinc-600 text-zinc-300'}`}>
                            ▶ 듣기
                          </button>
                        </div>
                        <div className="text-sm text-zinc-300 leading-relaxed">{savedAns.answerText}</div>
                      </div>
                    )}

                    {/* 입력 영역 */}
                    <div className="p-4 pt-0">
                      <textarea
                        className="w-full bg-zinc-800 text-sm text-white rounded-lg p-3 resize-none min-h-20 placeholder-zinc-600 focus:outline-none border border-zinc-700 focus:border-green-800"
                        placeholder="영어로 답변을 입력하거나 마이크로 말해보세요..."
                        value={ansInputs[i] || ''}
                        onChange={e => setAnsInputs(prev => ({ ...prev, [i]: e.target.value }))}
                      />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => toggleMic(i)}
                          className={`w-11 h-11 rounded-full border flex items-center justify-center flex-shrink-0 ${activeRec===i?'bg-red-950 border-red-800':'bg-zinc-800 border-zinc-700'}`}>
                          <svg className={`w-4 h-4 ${activeRec===i?'fill-red-400':'fill-zinc-400'}`} viewBox="0 0 24 24">
                            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm6 9a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93V20H8v2h8v-2h-3v-2.07A8 8 0 0 0 20 10h-2z"/>
                          </svg>
                        </button>
                        <button onClick={() => saveAnswer(i)}
                          className="flex-1 h-11 bg-green-950 border border-green-800 text-green-400 text-sm font-medium rounded-lg">
                          저장하기
                        </button>
                        <Timer onStop={(sec) => console.log(`${sec}초`)} />
                        <button onClick={() => playTTS(ansInputs[i]||'', `play-${i}`)}
                          className={`h-11 px-3 rounded-lg border text-xs flex items-center gap-1 ${activeTTS===`play-${i}`?'bg-green-950 border-green-800 text-green-400':'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                          ▶ 듣기
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 복습 탭 */}
        {tab === 'review' && (
          <div className="space-y-3">
            {reviewDue.length === 0 ? (
              <div className="text-center py-16 text-zinc-500 text-sm">
                <div className="text-3xl mb-3">✅</div>
                <div>복습할 항목이 없어요</div>
                <div className="text-xs mt-1 text-zinc-600">연습 후 3일/7일 후 자동으로 나타나요</div>
              </div>
            ) : reviewDue.map(a => (
              <div key={a.id} className="bg-zinc-900 border border-amber-900 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${LEVEL_COLORS[a.level]}`}>{a.level}</span>
                  <span className="text-xs text-amber-400">{a.reviewCount === 0 ? '3일 복습' : '7일 복습'}</span>
                </div>
                <div className="text-xs text-zinc-500 mb-1">{a.date}</div>
                <div className="text-sm text-white mb-2">{a.questionText}</div>
                <div className="text-sm text-zinc-300 border-l-2 border-green-700 pl-3 mb-3">{a.answerText}</div>
                <div className="flex gap-2">
                  <button onClick={() => playTTS(a.answerText, `rev-${a.id}`)}
                    className={`flex-1 h-10 rounded-lg border text-xs ${activeTTS===`rev-${a.id}`?'bg-green-950 border-green-800 text-green-400':'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>
                    ▶ 듣기
                  </button>
                  <button onClick={() => markReviewed(a.id)}
                    className="flex-1 h-10 bg-amber-950 border border-amber-800 text-amber-400 text-xs rounded-lg">
                    복습 완료 ✓
                  </button>
                  <button onClick={() => deleteAnswer(a.id)}
                    className="h-10 px-3 bg-red-950 border border-red-900 text-red-400 text-xs rounded-lg">
                    삭제
                  </button>
                </div>
              </div>
            ))}

            {answers.filter(a => !reviewDue.includes(a)).length > 0 && (
              <div className="mt-6">
                <div className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-3">전체 기록</div>
                {answers.filter(a => !reviewDue.includes(a)).map(a => (
                  <div key={a.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-500 font-mono">{a.date}</span>
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${LEVEL_COLORS[a.level]}`}>{a.level}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mb-1">{a.questionText}</div>
                    <div className="text-sm text-zinc-300 border-l-2 border-zinc-700 pl-3 mb-2">{a.answerText}</div>
                    <div className="flex gap-2">
                      <button onClick={() => playTTS(a.answerText, `all-${a.id}`)}
                        className={`flex-1 h-9 rounded-lg border text-xs ${activeTTS===`all-${a.id}`?'bg-green-950 border-green-800 text-green-400':'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>
                        ▶ 듣기
                      </button>
                      <button onClick={() => deleteAnswer(a.id)}
                        className="h-9 px-3 bg-red-950 border border-red-900 text-red-400 text-xs rounded-lg">삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 단어장 탭 */}
        {tab === 'vocab' && (
          <div className="space-y-3">
            {vocab.length === 0 ? (
              <div className="text-center py-16 text-zinc-500 text-sm">
                <div className="text-3xl mb-3">📖</div>
                <div>단어를 길게 눌러서 저장해보세요</div>
              </div>
            ) : vocab.map((v, i) => (
              <div key={v.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="font-mono text-lg text-white mb-1">{v.word}</div>
                <div className="text-xs text-zinc-500 mb-2">{v.from} · {v.date}</div>
                <div className="text-sm text-zinc-300 mb-3">{v.meaning}</div>
                <div className="flex gap-2">
                  <button onClick={() => playTTS(v.word, `vocab-${i}`)}
                    className={`flex-1 h-9 rounded-lg border text-xs ${activeTTS===`vocab-${i}`?'bg-green-950 border-green-800 text-green-400':'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>
                    발음 듣기
                  </button>
                  <button onClick={() => setVocab(prev => prev.filter((_,j)=>j!==i))}
                    className="h-9 px-3 bg-red-950 border border-red-900 text-red-400 text-xs rounded-lg">삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 단어 툴팁 */}
      {tooltip && (
        <div className="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-xl p-4 w-56 shadow-xl"
          style={{ top: tooltip.y, left: Math.min(tooltip.x, window.innerWidth - 230) }}
          onClick={e => e.stopPropagation()}>
          <div className="font-mono text-white text-base mb-2">{tooltip.word}</div>
          <button onClick={() => saveVocab(tooltip.word)}
            className="w-full py-2 bg-green-950 border border-green-800 text-green-400 text-sm rounded-lg">
            단어장에 저장
          </button>
        </div>
      )}
    </div>
  );
}
