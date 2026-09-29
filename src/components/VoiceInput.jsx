import React, { useRef, useState } from 'react';

// Shared voice control. In continuous mode it keeps collecting speech until the user
// explicitly taps Stop/Done. This is used by Smart Billing so a long Hindi/Hinglish
// shopping sentence is parsed as one complete command instead of one product at a time.
export default function VoiceInput({ onText, onDone, continuous = false, deferUntilDone = false }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef(null);
  const transcriptRef = useRef('');
  const stoppingRef = useRef(false);

  const stop = () => {
    stoppingRef.current = true;
    try { recRef.current?.stop(); } catch {}
  };

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    if (listening) { stop(); return; }

    const r = new SR();
    r.lang = 'hi-IN';
    r.continuous = Boolean(continuous);
    r.interimResults = false;
    transcriptRef.current = '';
    stoppingRef.current = false;

    r.onstart = () => setListening(true);
    r.onresult = (e) => {
      const chunk = Array.from(e.results)
        .slice(e.resultIndex || 0)
        .map(x => x[0]?.transcript || '')
        .join(' ')
        .trim();
      if (!chunk) return;
      transcriptRef.current = `${transcriptRef.current} ${chunk}`.trim();
      if (!deferUntilDone && !continuous) onText?.(chunk, transcriptRef.current);
      if (!deferUntilDone && continuous) onText?.(chunk, transcriptRef.current);
    };
    r.onerror = (event) => {
      // "no-speech" can happen naturally after a pause. In continuous mode the user can
      // keep talking; other errors end the current session.
      if (event?.error !== 'no-speech') setListening(false);
    };
    r.onend = () => {
      const full = transcriptRef.current.trim();
      if (continuous && !stoppingRef.current) {
        // Mobile Chrome/Samsung browser may end recognition after a short silence even
        // when continuous=true. Restart automatically so the user can keep speaking.
        setTimeout(() => {
          if (recRef.current === r && !stoppingRef.current) {
            try { r.start(); } catch {}
          }
        }, 120);
        return;
      }
      setListening(false);
      if (full) onDone?.(full);
      recRef.current = null;
    };

    recRef.current = r;
    try { r.start(); } catch { setListening(false); }
  };

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      className={`px-3 py-2 rounded-xl text-xs font-bold ${listening ? 'bg-red-100 text-red-600' : 'bg-violet-100 text-violet-700'}`}
    >
      {listening ? (continuous ? '🛑 Done / Stop' : '🔴 Listening…') : '🎙️ Voice'}
      {!supported && <span className="block text-[9px] font-normal">Voice unavailable</span>}
    </button>
  );
}
