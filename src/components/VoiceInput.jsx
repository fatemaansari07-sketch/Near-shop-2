import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

export default function VoiceInput({ onText, lang = "hi-IN", continuous = false, className = "" }) {
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch {} }, []);

  const toggle = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); setError("Is browser me voice input supported nahi hai. Chrome try kariye."); return; }
    if (listening) { try { recognitionRef.current?.stop(); } catch {} setListening(false); return; }

    const recognition = new SR();
    transcriptRef.current = "";
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.continuous = continuous;
    recognition.onstart = () => { setListening(true); setError(""); };
    recognition.onresult = (event) => {
      const heard = Array.from(event.results)
        .slice(event.resultIndex)
        .filter(r => r.isFinal !== false)
        .map(r => r[0]?.transcript || "")
        .join(" ")
        .trim();
      if (!heard) return;
      transcriptRef.current = `${transcriptRef.current} ${heard}`.trim();
      // For continuous mode, keep collecting; send the complete transcript so the
      // caller can parse several products/items from one recording.
      onText?.(transcriptRef.current);
    };
    recognition.onerror = (e) => {
      setError(e?.error === "not-allowed" ? "Microphone permission allow kariye." : "Voice input nahi mila, dobara try kariye.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { setListening(false); }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button type="button" onClick={toggle} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${listening ? "bg-red-100 text-red-600" : "bg-violet-50 text-violet-700"}`}>
        {listening ? <MicOff size={15} /> : <Mic size={15} />}
        {listening ? "Sun raha hoon…" : "Voice"}
      </button>
      {!supported && <span className="text-[10px] text-red-500">Chrome use karein</span>}
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}
