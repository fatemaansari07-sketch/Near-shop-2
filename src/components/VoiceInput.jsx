import React, { useRef, useState, useEffect } from 'react';

// Shared voice control used across the app.
// - Language choice (Hindi / Hinglish / English) is remembered and shared by every mic button.
// - continuous mode keeps listening until the user taps Stop/Done (Smart Billing).
// - Stop always works: if the browser engine hangs, the session is force-finished.
const LANGS = [
  { id: 'hi', code: 'hi-IN', label: 'हिंदी' },
  { id: 'hinglish', code: 'en-IN', label: 'Hinglish' },
  { id: 'en', code: 'en-US', label: 'English' },
];
const LS_KEY = 'ns_voice_lang';
const EVT = 'ns-voice-lang';
const readLang = () => {
  try { const v = localStorage.getItem(LS_KEY); return LANGS.some((l) => l.id === v) ? v : 'hi'; } catch { return 'hi'; }
};

export default function VoiceInput({ onText, onDone, continuous = false, deferUntilDone = false }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [lang, setLang] = useState(readLang);
  const recRef = useRef(null);
  const sessionRef = useRef(0);
  const committedRef = useRef('');
  const textRef = useRef('');
  const stoppingRef = useRef(false);
  const timerRef = useRef(null);
  const cbRef = useRef({});
  cbRef.current = { onText, onDone }; // always call the latest callbacks (no stale cart/state)

  useEffect(() => {
    const sync = () => setLang(readLang());
    window.addEventListener(EVT, sync);
    return () => {
      window.removeEventListener(EVT, sync);
      sessionRef.current++;
      clearTimeout(timerRef.current);
      const r = recRef.current;
      if (r) { r.onresult = r.onerror = r.onend = null; try { r.abort(); } catch {} }
    };
  }, []);

  const finalize = (session) => {
    if (session !== sessionRef.current) return; // already finished
    sessionRef.current++;
    clearTimeout(timerRef.current);
    const r = recRef.current;
    recRef.current = null;
    if (r) { r.onresult = r.onerror = r.onend = null; try { r.abort(); } catch {} }
    setListening(false);
    const full = textRef.current.trim();
    if (full) cbRef.current.onDone?.(full);
  };

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    if (recRef.current) { // kill any leftover engine from an earlier session
      const old = recRef.current;
      old.onresult = old.onerror = old.onend = null;
      try { old.abort(); } catch {}
      recRef.current = null;
    }
    const session = ++sessionRef.current;
    committedRef.current = '';
    textRef.current = '';
    stoppingRef.current = false;
    let emptyRuns = 0;

    const run = () => {
      const r = new SR();
      r.lang = (LANGS.find((l) => l.id === readLang()) || LANGS[0]).code;
      r.continuous = Boolean(continuous);
      r.interimResults = false;
      r.onresult = (e) => {
        if (session !== sessionRef.current) return;
        const all = Array.from(e.results).map((x) => x[0]?.transcript || '').join(' ').trim();
        if (!all) return;
        emptyRuns = 0;
        // Rebuild from all results of this engine run (avoids duplicated text on Android Chrome).
        textRef.current = `${committedRef.current} ${all}`.trim();
        if (!deferUntilDone) {
          const chunk = Array.from(e.results).slice(e.resultIndex || 0).map((x) => x[0]?.transcript || '').join(' ').trim();
          if (chunk) cbRef.current.onText?.(chunk, textRef.current);
        }
      };
      r.onerror = (ev) => {
        if (session !== sessionRef.current) return;
        const err = ev?.error;
        if (err === 'no-speech' || err === 'aborted') return;
        if (err === 'not-allowed' || err === 'service-not-allowed') alert('Mic ki permission chahiye. Browser settings me mic allow kariye.');
        else if (err === 'network') alert('Voice ke liye internet chahiye.');
        stoppingRef.current = true;
        finalize(session);
      };
      r.onend = () => {
        if (session !== sessionRef.current) return;
        committedRef.current = textRef.current;
        if (continuous && !stoppingRef.current) {
          // Mobile Chrome ends recognition after short silence even in continuous mode: restart.
          if (++emptyRuns > 8) { finalize(session); return; }
          setTimeout(() => {
            if (session !== sessionRef.current || stoppingRef.current) return;
            try { run(); } catch { finalize(session); }
          }, 150);
          return;
        }
        finalize(session);
      };
      recRef.current = r;
      r.start();
    };

    try { run(); setListening(true); } catch { setListening(false); }
  };

  const stop = () => {
    const session = sessionRef.current;
    stoppingRef.current = true;
    try { recRef.current?.stop(); } catch {}
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => finalize(session), 1500); // engine hung? force finish
  };

  const changeLang = (e) => {
    const v = e.target.value;
    setLang(v);
    try { localStorage.setItem(LS_KEY, v); } catch {}
    try { window.dispatchEvent(new Event(EVT)); } catch {}
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={listening ? stop : start}
        className={`px-3 py-2 rounded-xl text-xs font-bold ${listening ? 'bg-red-100 text-red-600' : 'bg-violet-100 text-violet-700'}`}
      >
        {listening ? (continuous ? '🛑 Done / Stop' : '🔴 Listening…') : '🎙️ Voice'}
        {!supported && <span className="block text-[9px] font-normal">Voice unavailable</span>}
      </button>
      <select
        value={lang}
        onChange={changeLang}
        disabled={listening}
        aria-label="Voice language"
        className="text-[11px] font-semibold bg-gray-100 text-gray-700 rounded-lg px-1.5 py-2 outline-none"
      >
        {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
      </select>
    </span>
  );
}
