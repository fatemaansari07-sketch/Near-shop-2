import React,{useRef,useState} from 'react';
export default function VoiceInput({onText,continuous=false}){const [listening,setListening]=useState(false);const [supported,setSupported]=useState(true);const recRef=useRef(null);const start=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){setSupported(false);return;}const r=new SR();
// BUG FIX: 'hi-IN' made the browser transcribe everything in Devanagari script, so an English
// product name like "Paracetamol" came out as हिंदी text instead of Hinglish/Roman letters, and
// broke the English keyword matching (price/stock) parseProductVoice relies on. 'en-IN' handles
// Hindi-English code-switched speech the way shopkeepers actually talk, in Roman script.
r.lang='en-IN';r.continuous=continuous;r.interimResults=false;r.onstart=()=>setListening(true);r.onend=()=>setListening(false);r.onerror=()=>setListening(false);r.onresult=e=>{const t=Array.from(e.results).map(x=>x[0]?.transcript||'').join(' ').trim();if(t)onText?.(t,t)};recRef.current=r;r.start()};return <button type="button" onClick={start} className={`px-3 py-2 rounded-xl text-xs font-bold ${listening?'bg-red-100 text-red-600':'bg-violet-100 text-violet-700'}`}>{listening?'🔴 Listening…':'🎙️ Voice'}{!supported&&<span className="block text-[9px] font-normal">Voice unavailable</span>}</button>}
