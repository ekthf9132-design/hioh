'use client';
import { useState } from 'react';

const WEBHOOK = 'https://script.google.com/macros/s/AKfycbxSEXJ8_xKuf-whhiaiOD2QgmmlL2TnbeA9UwzObcaBHg1b3RoUHSoPdVjEF3TFezto/exec';

export default function SavePage() {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState<any>(null);

  const parse = (text: string) => {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  };

  const handleChange = (v: string) => {
    setInput(v);
    setPreview(parse(v));
  };

  const save = async () => {
    const data = parse(input);
    if (!data) return setStatus('JSON 형식을 확인해주세요.');
    setStatus('저장 중...');
    try {
      await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data)
      });
      setStatus('✅ 저장됐어요!');
      setInput('');
      setPreview(null);
    } catch {
      setStatus('❌ 저장 실패. 다시 시도해주세요.');
    }
  };

  return (
    <div className="min-h-dvh bg-[#111318] text-white p-5 pt-12 font-sans">
      <div className="max-w-lg mx-auto">
        <div className="text-emerald-400 font-mono text-xl font-bold mb-1">단어 저장</div>
        <div className="text-zinc-500 text-sm mb-6">ChatGPT 답변 마지막 JSON을 복붙하세요</div>

        <textarea
          className="w-full bg-[#1e2128] border border-zinc-700 rounded-xl p-4 text-sm text-white resize-none min-h-32 focus:outline-none focus:border-emerald-600 placeholder-zinc-600 font-mono"
          placeholder={'{"word":"ephemeral","meaning":"덧없는","example":"Fame is ephemeral.","pos":"adjective"}'}
          value={input}
          onChange={e => handleChange(e.target.value)}
        />

        {preview && (
          <div className="mt-3 bg-[#1e2128] border border-emerald-900 rounded-xl p-4 space-y-2">
            <div className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-2">미리보기</div>
            <div className="flex gap-3 items-baseline">
              <span className="text-lg font-bold text-white">{preview.word}</span>
              <span className="text-xs text-emerald-400 font-mono">{preview.pos}</span>
            </div>
            <div className="text-sm text-zinc-300">{preview.meaning}</div>
            <div className="text-sm text-zinc-500 italic">{preview.example}</div>
          </div>
        )}

        <button
          onClick={save}
          disabled={!preview}
          className="w-full mt-4 py-3 bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold rounded-xl text-sm transition-all"
        >
          스프레드시트에 저장 →
        </button>

        {status && (
          <div className={`mt-3 text-center text-sm ${status.includes('✅') ? 'text-emerald-400' : status.includes('❌') ? 'text-red-400' : 'text-zinc-400'}`}>
            {status}
          </div>
        )}

        <div className="mt-8 text-xs text-zinc-600 text-center">
          저장된 단어는 Google Sheets dap 파일에서 확인하세요
        </div>
      </div>
    </div>
  );
}
