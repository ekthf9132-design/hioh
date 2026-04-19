'use client';
import { useState, useEffect, useRef } from 'react';

interface Props { onStop?: (sec: number) => void; }

export default function Timer({ onStop }: Props) {
  const [sec, setSec] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<NodeJS.Timeout|null>(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setSec(s => s + 1), 1000);
    } else {
      if (ref.current) clearInterval(ref.current);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const toggle = () => {
    if (running) { onStop?.(sec); setRunning(false); setSec(0); }
    else setRunning(true);
  };

  return (
    <button onClick={toggle} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-mono transition-all ${running ? 'bg-red-950 border-red-800 text-red-400' : 'bg-zinc-900 border-zinc-700 text-zinc-400'}`}>
      <span>{running ? '⏹' : '⏱'}</span>
      <span>{fmt(sec)}</span>
    </button>
  );
}
