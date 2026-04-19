'use client';
import { useState, useEffect } from 'react';

export function useStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) setValue(JSON.parse(stored));
    } catch {}
  }, [key]);

  const set = (newVal: T | ((prev: T) => T)) => {
    setValue(prev => {
      const next = typeof newVal === 'function' ? (newVal as (p: T) => T)(prev) : newVal;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return [value, set] as const;
}
