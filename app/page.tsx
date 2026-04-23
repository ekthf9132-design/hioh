'use client';
import { useState, useRef } from 'react';
import { useStorage } from './hooks/useStorage';
import { Question, AnswerRecord, VocabWord, StudyStreak, Level, LEVEL_CONFIG } from './types';

type Tab = 'practice' | 'review' | 'vocab';

export default function Home() {
  const [tab, setTab] = useState<Tab>('practice');
  const [level, setLevel] = useState<Level>('IH');
  const [pasteText, setPasteText] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [savedQuestions, setSavedQuestions] = useStorage<Question[]>('hioh_questions', []);
  const [vocab, setVocab] = useStorage<VocabWord[]>('hioh_vocab', []);
  const [streak, setStreak] = useStorage<StudyStreak>('hioh_streak', { lastStudyDate: '', currentStreak: 0, longestStreak: 0 });
  const [activeRec, setActiveRec] = useState<string | null>(null);
  const [activeTTS, setActiveTTS] = useState<string | null>(null);
  const [ansInputs, setAnsInputs] = useState<Record<string, string>>({});
  const [timer, setTimer] = useState<Record<string, number>>({});
  const [timerRunning, setTimerRunning] = useState<Record<string, boolean>>({});
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [searchVocab, setSearchVocab] = useState('');
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Record<string, Blob[]>>({});
  const timerRef = useRef<Record<string, NodeJS.Timeout>>({});

  const LEVELS: Level[] = ['IM1', 'IM2', 'IM3', 'IH', 'AL'];

  const getLevelStyle = (lv: Level) => {
    const c = LEVEL_CONFIG[lv];
    return `${c.bg} ${c.border} ${c.text}`;
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
      else if (line.length > 15) parsed.push(line);
    });
    if (!parsed.length) return alert('질문을 찾지 못했어요.\n1. 2. 3. 형식으로 입력해주세요.');
    const newQs: Question[] = parsed.map(text => {
      const existing = savedQuestions.find(q => q.text === text);
      return existing || { id: Date.now().toString() + Math.random(), text, records: [], reviewCount: 0 };
    });
    setQuestions(newQs);
    setAnsInputs({});
    setPasteText('');
  };

  const startTimer = (qId: string) => {
    if (timerRunning[qId]) return;
    setTimerRunning(prev => ({ ...prev, [qId]: true }));
    timerRef.current[qId] = setInterval(() => {
      setTimer(prev => ({ ...prev, [qId]: (prev[qId] || 0) + 1 }));
    }, 1000);
  };

  const stopTimer = (qId: string) => {
    clearInterval(timerRef.current[qId]);
    setTimerRunning(prev => ({ ...prev, [qId]: false }));
  };

  const resetTimer = (qId: string) => {
    stopTimer(qId);
    setTimer(prev => ({ ...prev, [qId]: 0 }));
  };

  const fmtTime = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const toggleMic = async (qId: string) => {
    if (activeRec === qId) {
      mediaRecorderRef.current?.stop();
      setActiveRec(null);
      stopTimer(qId);
      return;
    }
    if (activeRec) {
      mediaRecorderRef.current?.stop();
      stopTimer(activeRec);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current[qId] = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mr = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = (e: any) => {
        if (e.data.size > 0) audioChunksRef.current[qId].push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current[qId], { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrls(prev => ({ ...prev, [qId]: url }));
        stream.getTracks().forEach((t: any) => t.stop());
      };
      mr.start(100);
      mediaRecorderRef.current = mr;
      setActiveRec(qId);
      startTimer(qId);
    } catch (e) {
      alert('마이크 권한을 허용해주세요.\n설정 > Safari > 마이크 허용');
    }
  };

  const saveAnswer = (qId: string) => {
    const text = ansInputs[qId]?.trim();
    if (!text) return alert('답변을 입력해주세요.');
    const record: AnswerRecord = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' }),
      answerText: text,
      level,
      duration: timer[qId] || 0,
      audioUrl: audioUrls[qId] || undefined,
    };
    const updatedQ = questions.map(q => {
      if (q.id !== qId) return q;
      const review3 = new Date(Date.now() + 3 * 86400000).toISOString();
      return { ...q, records: [...q.records, record], nextReview: q.nextReview || review3 };
    });
    setQuestions(updatedQ);
    setSavedQuestions(prev => {
      const exists = prev.find(q => q.id === qId);
      if (exists) return prev.map(q => q.id === qId ? updatedQ.find(u => u.id === qId)! : q);
      return [...prev, updatedQ.find(u => u.id === qId)!];
    });
    updateStreak();
    resetTimer(qId);
    setAnsInputs(prev => ({ ...prev, [qId]: '' }));
    setAudioUrls(prev => ({ ...prev, [qId]: '' }));
  };

  const playTTS = (text: string, id: string) => {
    if (!text.trim()) return;
    if (activeTTS) { window.speechSynthesis.cancel(); setActiveTTS(null); if (activeTTS === id) return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.88;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => v.lang.startsWith('en-US')) || voices.find(v => v.lang.startsWith('en'));
    if (v) u.voice = v;
    setActiveTTS(id);
    u.onend = () => setActiveTTS(null);
    window.speechSynthesis.speak(u);
  };

  const reviewDue = savedQuestions.filter(q => q.nextReview && new Date(q.nextReview) <= new Date() && q.records.length > 0);

  const markReviewed = (id: string) => {
    setSavedQuestions(prev => prev.map(q => {
      if (q.id !== id) return q;
      const days = q.reviewCount === 0 ? 7 : 14;
      return { ...q, reviewCount: q.reviewCount + 1, nextReview: new Date(Date.now() + days * 86400000).toISOString() };
    }));
    updateStreak();
  };

  const saveVocab = (word: string) => {
    if (vocab.some(v => v.word.toLowerCase() === word.toLowerCase())) return;
    setVocab(prev => [...prev, { id: Date.now().toString(), word, meaning: '(사전 검색 후 입력)', partOfSpeech: '', level: '', from: '질문지', date: new Date().toLocaleDateString('ko-KR') }]);
  };

  const filteredVocab = vocab.filter(v => v.word.toLowerCase().includes(searchVocab.toLowerCase()));
  const totalAnswers = savedQuestions.reduce((acc, q) => acc + q.records.length, 0);

  return (
    <div className="min-h-dvh bg-[#111318] text-white font-sans">
      <div className="flex items-center justify-between px-5 pt-12 pb-4 sticky top-0 bg-[#111318] z-20">
        <span className="text-2xl font-bold text-emerald-400 tracking-tight">hioh</span>
        <div className="flex items-center gap-2 bg-[#1e2128] border border-zinc-700 rounded-full px-4 py-1.5">
          <span className="text-sm font-bold text-white">{streak.currentStreak}</span>
          <span className="text-base">🔥</span>
        </div>
      </div>

      <div className="flex border-b border-zinc-800 px-5 sticky top-16 bg-[#111318] z-20">
        {([['practice','연습','👤'],['review','복습','📋'],['vocab','단어장','📖']] as [Tab,string,string][]).map(([t,label,icon]) => (
          <button key={t} onClick={() => setTab(t as Tab)}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs border-b-2 transition-all ${tab===t?'border-emerald-400 text-emerald-400':'border-transparent text-zinc-600'}`}>
            <span className="text-base">{icon}</span>
            <span>{label}{t==='review'&&reviewDue.length>0?` (${reviewDue.length})`:''}{t==='vocab'&&vocab.length>0?` (${vocab.length})`:''}</span>
          </button>
        ))}
      </div>

      <div className="px-5 pb-32 pt-5">

        {tab === 'practice' && (
          <div className="space-y-5">
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-3">TARGET LEVEL</div>
              <div className="flex gap-2">
                {LEVELS.map(l => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${level===l ? getLevelStyle(l) : 'bg-[#1e2128] border-zinc-700 text-zinc-500'}`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-zinc-500 bg-[#1e2128] border border-zinc-800 rounded-xl px-4 py-2.5 leading-relaxed">
                <span className={`font-semibold ${LEVEL_CONFIG[level].text}`}>LEVEL HINT: {level}</span>
                <span className="ml-2">{LEVEL_CONFIG[level].tips}</span>
              </div>
            </div>

            <div className="bg-[#1e2128] border border-zinc-800 rounded-2xl p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-3">Paste your OPIc question here...</div>
              <textarea
                className="w-full bg-[#111318] text-sm text-white rounded-xl p-3 resize-none min-h-24 placeholder-zinc-700 focus:outline-none border border-zinc-800 focus:border-emerald-800"
                placeholder={"1. Tell me about your hometown.\n2. Describe your daily routine.\n3. What do you do in your free time?"}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
              />
              <button onClick={parseQuestions}
                className="w-full mt-3 py-3 bg-emerald-500 text-black text-sm font-bold rounded-xl active:scale-95 transition-transform">
                질문 카드 생성 →
              </button>
            </div>

            {questions.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-1 bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${Math.round(questions.filter(q=>q.records.length>0).length/questions.length*100)}%` }} />
                </div>
                <span className="text-xs text-zinc-500 font-mono">
                  {questions.filter(q=>q.records.length>0).length}/{questions.length}
                </span>
              </div>
            )}

            {questions.map((q) => {
              const isRec = activeRec === q.id;
              const isDone = q.records.length > 0;
              const t = timer[q.id] || 0;
              const circumference = 2 * Math.PI * 54;
              const maxSec = 120;
              const progress = Math.min(t / maxSec, 1);
              return (
                <div key={q.id} className={`bg-[#1e2128] border rounded-2xl overflow-hidden transition-all ${isDone?'border-emerald-900':'border-zinc-800'}`}>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs font-mono px-2.5 py-1 rounded-full border ${getLevelStyle(level)}`}>LEVEL HINT: {level}</span>
                      {isDone && <span className="text-xs text-emerald-400 font-mono">{q.records.length}회 답변</span>}
                      <button onClick={() => playTTS(q.text, `q-${q.id}`)} className="ml-auto text-zinc-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M9 9v6"/></svg>
                      </button>
                    </div>
                    <div className="text-[15px] text-white leading-relaxed border-l-2 border-emerald-500 pl-3 mb-4">
                      "{q.text}"
                    </div>

                    <div className="flex flex-col items-center my-4">
                      <div className="relative w-32 h-32">
                        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="54" fill="none" stroke="#1e2128" strokeWidth="8"/>
                          <circle cx="60" cy="60" r="54" fill="none" stroke={isRec?"#10b981":"#374151"} strokeWidth="8"
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference * (1 - progress)}
                            strokeLinecap="round" className="transition-all duration-1000"/>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold font-mono text-white">{fmtTime(t)}</span>
                          <span className="text-xs text-zinc-500 uppercase tracking-widest">{isRec ? 'RECORDING' : 'READY'}</span>
                        </div>
                      </div>
                    </div>

                    {/* 녹음본 미리듣기 */}
                    {audioUrls[q.id] && !isRec && (
                      <div className="mb-3 bg-[#111318] rounded-xl p-3 flex items-center gap-3">
                        <span className="text-xs text-zinc-500 font-mono flex-shrink-0">녹음본</span>
                        <audio controls src={audioUrls[q.id]} className="flex-1 h-8"/>
                      </div>
                    )}

                    {/* 답변 입력 */}
                    <div className="mb-3">
                      <div className="text-xs text-zinc-600 font-mono mb-1.5 uppercase tracking-widest">답변 입력</div>
                      <textarea
                        className={`w-full bg-[#111318] text-sm text-white rounded-xl p-3 resize-none min-h-20 border focus:outline-none transition-all ${isRec?'border-emerald-600':'border-zinc-800 focus:border-emerald-800'}`}
                        placeholder="녹음 후 직접 타이핑하거나 텍스트를 입력하세요..."
                        value={ansInputs[q.id] || ''}
                        onChange={e => setAnsInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                      />
                    </div>

                    <div className="bg-[#111318] rounded-2xl p-4 flex items-center justify-between">
                      <button onClick={() => { resetTimer(q.id); setAudioUrls(prev=>({...prev,[q.id]:''})); }}
                        className="w-11 h-11 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 text-lg">
                        ✕
                      </button>
                      <button onClick={() => toggleMic(q.id)}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isRec?'bg-red-500 shadow-lg shadow-red-500/30':'bg-emerald-500 shadow-lg shadow-emerald-500/20'}`}>
                        {isRec ? (
                          <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                        ) : (
                          <svg className="w-7 h-7 fill-black" viewBox="0 0 24 24"><path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm6 9a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93V20H8v2h8v-2h-3v-2.07A8 8 0 0 0 20 10h-2z"/></svg>
                        )}
                      </button>
                      <button onClick={() => saveAnswer(q.id)}
                        className="w-11 h-11 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 text-lg">
                        💾
                      </button>
                    </div>
                  </div>

                  {isDone && (
                    <div className="border-t border-zinc-800">
                      <button onClick={() => setExpandedQ(expandedQ===q.id?null:q.id)}
                        className="w-full px-4 py-3 text-xs text-zinc-500 flex items-center justify-between">
                        <span className="font-mono uppercase tracking-widest">이전 답변 {q.records.length}개 비교</span>
                        <span>{expandedQ===q.id?'▲':'▼'}</span>
                      </button>
                      {expandedQ===q.id && (
                        <div className="px-4 pb-4 space-y-3">
                          {q.records.slice().reverse().map((r) => (
                            <div key={r.id} className="bg-[#111318] rounded-xl p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-zinc-500 font-mono">{r.date}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${getLevelStyle(r.level)}`}>{r.level}</span>
                                  {r.duration ? <span className="text-xs text-zinc-600 font-mono">{fmtTime(r.duration)}</span> : null}
                                  <button onClick={() => playTTS(r.answerText, `rec-${r.id}`)}
                                    className={`text-xs px-2 py-1 rounded-lg border ${activeTTS===`rec-${r.id}`?'bg-emerald-950 border-emerald-800 text-emerald-400':'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                                    TTS ▶
                                  </button>
                                </div>
                              </div>
                              <div className="text-sm text-zinc-300 leading-relaxed border-l-2 border-zinc-700 pl-3 mb-2">
                                {r.answerText}
                              </div>
                              {r.audioUrl && (
                                <div className="mt-2">
                                  <div className="text-xs text-zinc-600 mb-1 font-mono">녹음본</div>
                                  <audio controls src={r.audioUrl} className="w-full h-8"/>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'review' && (
          <div className="space-y-4">
            <div>
              <div className="text-3xl font-bold text-white mb-1">복습</div>
              <div className="text-sm text-zinc-500">기억이 사라지기 전에 다시 한 번 복습하세요.<br/>망각 곡선을 이겨내는 스마트한 학습 여정입니다.</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1e2128] border border-zinc-800 rounded-2xl p-4">
                <div className="text-2xl font-bold text-emerald-400">{totalAnswers}</div>
                <div className="text-xs text-zinc-500 mt-1">총 답변 수</div>
              </div>
              <div className="bg-[#1e2128] border border-zinc-800 rounded-2xl p-4">
                <div className="text-2xl font-bold text-emerald-400">{streak.longestStreak}일</div>
                <div className="text-xs text-zinc-500 mt-1">최장 스트릭</div>
              </div>
            </div>

            {reviewDue.length > 0 && (
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-3">
                  UPCOMING REVIEWS <span className="text-emerald-400">{reviewDue.length}/{savedQuestions.length}</span>
                </div>
                {reviewDue.map(q => (
                  <div key={q.id} className="bg-[#1e2128] border border-amber-900 rounded-2xl p-4 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-amber-950 border border-amber-800 text-amber-400 px-2 py-0.5 rounded-full font-mono">
                        {q.reviewCount === 0 ? '3 DAY INTERVAL' : '7 DAY INTERVAL'}
                      </span>
                    </div>
                    <div className="text-sm text-white mb-2">"{q.text}"</div>
                    <div className="text-sm text-zinc-400 border-l-2 border-amber-700 pl-3 mb-3">
                      {q.records[q.records.length-1]?.answerText.slice(0,80)}...
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => playTTS(q.records[q.records.length-1]?.answerText||'', `rev-${q.id}`)}
                        className={`h-10 px-4 rounded-xl border text-xs font-mono ${activeTTS===`rev-${q.id}`?'bg-emerald-950 border-emerald-800 text-emerald-400':'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>
                        ▶ TTS
                      </button>
                      <button onClick={() => markReviewed(q.id)}
                        className="flex-1 h-10 bg-emerald-500 text-black text-xs font-bold rounded-xl uppercase tracking-widest">
                        COMPLETE REVIEW
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-3">TOTAL SPEAKING HISTORY</div>
            {savedQuestions.filter(q=>q.records.length>0).length === 0 ? (
              <div className="text-center py-16 text-zinc-600 text-sm">
                <div className="text-4xl mb-3">📋</div>
                <div>연습 후 저장하면 기록이 쌓여요</div>
              </div>
            ) : savedQuestions.filter(q=>q.records.length>0).map(q => (
              <div key={q.id} className="bg-[#1e2128] border border-zinc-800 rounded-2xl mb-3 overflow-hidden">
                <button onClick={() => setExpandedQ(expandedQ===q.id?null:q.id)}
                  className="w-full p-4 flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 fill-zinc-400" viewBox="0 0 24 24"><path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm6 9a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93V20H8v2h8v-2h-3v-2.07A8 8 0 0 0 20 10h-2z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{q.text.slice(0,40)}</div>
                    <div className="text-xs text-zinc-500">{q.records[q.records.length-1]?.date} · {q.records.length}회 답변</div>
                  </div>
                  <span className="text-zinc-600">{expandedQ===q.id?'▲':'▼'}</span>
                </button>
                {expandedQ===q.id && (
                  <div className="px-4 pb-4 space-y-3 border-t border-zinc-800 pt-3">
                    {q.records.slice().reverse().map(r => (
                      <div key={r.id} className="bg-[#111318] rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-zinc-500 font-mono">{r.date}</span>
                          <div className="flex gap-2 items-center">
                            <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${getLevelStyle(r.level)}`}>{r.level}</span>
                            {r.duration ? <span className="text-xs text-zinc-600 font-mono">{fmtTime(r.duration)}</span> : null}
                            <button onClick={() => playTTS(r.answerText, `hr-${r.id}`)}
                              className={`text-xs px-2 py-1 rounded-lg border ${activeTTS===`hr-${r.id}`?'bg-emerald-950 border-emerald-800 text-emerald-400':'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>TTS ▶</button>
                          </div>
                        </div>
                        <div className="text-sm text-zinc-300 leading-relaxed border-l-2 border-zinc-700 pl-3 mb-2">{r.answerText}</div>
                        {r.audioUrl && (
                          <div className="mt-2">
                            <div className="text-xs text-zinc-600 mb-1 font-mono">녹음본 재생</div>
                            <audio controls src={r.audioUrl} className="w-full h-8"/>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'vocab' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-1">VOCABULARY BANK</div>
              <div className="text-3xl font-bold text-white mb-4">단어장</div>
              <div className="flex items-center gap-3 bg-[#1e2128] border border-zinc-800 rounded-2xl px-4 py-3">
                <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                  placeholder="Search words..." value={searchVocab} onChange={e=>setSearchVocab(e.target.value)}/>
              </div>
            </div>
            {vocab.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-500 uppercase tracking-widest font-mono">RECENT ADDITIONS</div>
                <button className="text-xs text-emerald-400 font-mono">VIEW ALL</button>
              </div>
            )}
            {filteredVocab.length === 0 ? (
              <div className="text-center py-16 text-zinc-600 text-sm">
                <div className="text-4xl mb-3">📖</div>
                <div>아래 버튼으로 단어를 직접 추가해보세요</div>
              </div>
            ) : filteredVocab.map((v, i) => (
              <div key={v.id} className="bg-[#1e2128] border border-zinc-800 rounded-2xl p-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xl font-bold text-white mb-1">{v.word}</div>
                  <div className="text-sm text-zinc-400 mb-3">{v.meaning}</div>
                  <div className="flex gap-2 flex-wrap">
                    {v.partOfSpeech && <span className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 px-2 py-0.5 rounded-full uppercase font-mono">{v.partOfSpeech}</span>}
                    {v.level && <span className="text-xs bg-emerald-950 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded-full uppercase font-mono">{v.level}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 ml-3">
                  <button onClick={() => playTTS(v.word, `vocab-${i}`)}
                    className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all ${activeTTS===`vocab-${i}`?'bg-emerald-500 border-emerald-400':'bg-emerald-950 border-emerald-800'}`}>
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M9 9v6"/></svg>
                  </button>
                  <button onClick={() => setVocab(prev => prev.filter((_,j)=>j!==i))}
                    className="w-11 h-11 rounded-full border border-red-900 bg-red-950 flex items-center justify-center text-red-400 text-sm">
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {/* 단어 직접 추가 */}
            <div className="bg-[#1e2128] border border-zinc-800 rounded-2xl p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-3">단어 추가</div>
              <div className="flex gap-2 mb-2">
                <input id="vocab-word-input" className="flex-1 bg-[#111318] text-sm text-white rounded-xl px-3 py-2.5 border border-zinc-800 focus:outline-none focus:border-emerald-800"
                  placeholder="영어 단어 입력 (예: ephemeral)"/>
                <button id="vocab-auto-btn" onClick={async () => {
                  const w = (document.getElementById('vocab-word-input') as HTMLInputElement)?.value.trim();
                  if (!w) return alert('단어를 입력해주세요.');
                  const btn = document.getElementById('vocab-auto-btn') as HTMLButtonElement;
                  const mi = document.getElementById('vocab-meaning-input') as HTMLInputElement;
                  const ei = document.getElementById('vocab-example-input') as HTMLInputElement;
                  btn.textContent = '검색 중...';
                  btn.disabled = true;
                  try {
                    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${w}`);
                    const data = await res.json();
                    if (!Array.isArray(data)) throw new Error('not found');
                    const meanings = data[0]?.meanings?.[0];
                    const definition = meanings?.definitions?.[0];
                    const partOfSpeech = meanings?.partOfSpeech || '';
                    const meaning = `${partOfSpeech}. ${definition?.definition || ''}`;
                    const example = definition?.example || '';
                    if (mi) mi.value = meaning;
                    if (ei) ei.value = example;
                  } catch(e) {
                    alert('자동 검색 실패. 직접 입력해주세요.');
                  }
                  btn.textContent = '자동입력';
                  btn.disabled = false;
                }} className="px-3 py-2.5 bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs rounded-xl font-mono whitespace-nowrap">
                  자동입력
                </button>
              </div>
              <input id="vocab-meaning-input" className="w-full bg-[#111318] text-sm text-white rounded-xl px-3 py-2.5 border border-zinc-800 focus:outline-none focus:border-emerald-800 mb-2"
                placeholder="한국어 뜻 (자동입력 또는 직접 입력)"/>
              <input id="vocab-example-input" className="w-full bg-[#111318] text-sm text-white rounded-xl px-3 py-2.5 border border-zinc-800 focus:outline-none focus:border-emerald-800 mb-3"
                placeholder="예문 (자동입력 또는 직접 입력)"/>
              <button onClick={() => {
                const w = (document.getElementById('vocab-word-input') as HTMLInputElement)?.value.trim();
                const m = (document.getElementById('vocab-meaning-input') as HTMLInputElement)?.value.trim();
                const e = (document.getElementById('vocab-example-input') as HTMLInputElement)?.value.trim();
                if (!w) return alert('단어를 입력해주세요.');
                if (vocab.some(v => v.word.toLowerCase() === w.toLowerCase())) return alert('이미 저장된 단어예요.');
                setVocab(prev => [...prev, { id: Date.now().toString(), word: w, meaning: m || '(뜻 없음)', partOfSpeech: '', level: '', from: '직접 추가', date: new Date().toLocaleDateString('ko-KR'), example: e || '' }]);
                (document.getElementById('vocab-word-input') as HTMLInputElement).value = '';
                (document.getElementById('vocab-meaning-input') as HTMLInputElement).value = '';
                (document.getElementById('vocab-example-input') as HTMLInputElement).value = '';
              }} className="w-full py-2.5 bg-emerald-500 text-black text-sm font-bold rounded-xl">
                단어장에 저장 +
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
