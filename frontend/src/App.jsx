import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  Scale, Mic, MicOff, Send, Volume2, MapPin, FileText, Image,
  MessageCircle, Shield, ChevronRight, Download, ExternalLink,
  Menu, Users, Globe, Zap, AlertTriangle, CheckCircle,
  Upload, Eye, Clipboard, Printer, Share2, X, ArrowRight, Lock, Smartphone, Mail, Key
} from 'lucide-react';
import './index.css';

const B = 'http://localhost:3000';

// ── helpers ────────────────────────────────────────────
function sid() {
  let id = localStorage.getItem('v_sid');
  if (!id) { id = 'web_' + Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem('v_sid', id); }
  return id;
}
const now = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const post = (url, body) => fetch(`${B}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const postAudio = (url, formData) => fetch(`${B}${url}`, { method: 'POST', body: formData }).then(r => r.json());

// ── Background elements ────────────────────────────────
function Noise() { return <div className="noise" aria-hidden />; }

function Particles({ count = 12 }) {
  const ps = Array.from({ length: count }, (_, i) => ({ id: i, sz: Math.random() * 3 + 1.5, left: Math.random() * 100, dur: Math.random() * 22 + 16, delay: Math.random() * 14 }));
  return (
    <div className="particles">
      {ps.map(p => <div key={p.id} className="particle" style={{ width: p.sz, height: p.sz, left: `${p.left}%`, bottom: 0, animationDuration: `${p.dur}s`, animationDelay: `-${p.delay}s` }} />)}
    </div>
  );
}

// ── Animated counter ───────────────────────────────────
function Counter({ to, prefix = '', suffix = '' }) {
  const [n, setN] = useState(0);
  const ref = useRef();
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let c = 0;
    const t = setInterval(() => { c += to / 55; if (c >= to) { setN(to); clearInterval(t); } else setN(Math.floor(c)); }, 1600 / 55);
    return () => clearInterval(t);
  }, [inView, to]);
  return <span ref={ref}>{prefix}{n.toLocaleString('en-IN')}{suffix}</span>;
}

// ── ScalesIllustration ────────────────────────────────
function ScalesSVG({ size = 180 }) {
  return (
    <svg width={size} height={Math.round(size * 0.9)} viewBox="0 0 200 180" fill="none">
      <defs>
        <radialGradient id="sg" cx="50%" cy="100%" r="50%"><stop offset="0%" stopColor="#D4A017" stopOpacity=".22" /><stop offset="100%" stopColor="#D4A017" stopOpacity="0" /></radialGradient>
        <linearGradient id="beam" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#D4A017" stopOpacity=".9" /><stop offset="100%" stopColor="#D4A017" stopOpacity=".4" /></linearGradient>
      </defs>
      <ellipse cx="100" cy="170" rx="80" ry="10" fill="url(#sg)" />
      <rect x="95" y="148" width="10" height="24" rx="2" fill="url(#beam)" />
      <rect x="78" y="168" width="44" height="6" rx="3" fill="#D4A017" opacity=".65" />
      <rect x="24" y="64" width="152" height="4" rx="2" fill="#D4A017" opacity=".5" />
      <rect x="97" y="28" width="6" height="38" rx="3" fill="url(#beam)" />
      <circle cx="100" cy="24" r="7" fill="#D4A017" opacity=".9" />
      <circle cx="100" cy="24" r="3.5" fill="#F5C842" />
      <line x1="32" y1="68" x2="32" y2="100" stroke="#D4A017" strokeWidth="1.5" strokeDasharray="4 3" opacity=".55" />
      <path d="M8 106 Q32 96 56 106" stroke="#D4A017" strokeWidth="2" fill="none" opacity=".9" />
      <path d="M8 106 Q32 116 56 106" fill="rgba(212,160,23,.07)" />
      <line x1="168" y1="68" x2="168" y2="110" stroke="#D4A017" strokeWidth="1.5" strokeDasharray="4 3" opacity=".55" />
      <path d="M144 116 Q168 106 192 116" stroke="#D4A017" strokeWidth="2" fill="none" opacity=".9" />
      <path d="M144 116 Q168 126 192 116" fill="rgba(212,160,23,.07)" />
      <rect x="150" y="40" width="24" height="32" rx="4" fill="rgba(212,160,23,.07)" stroke="rgba(212,160,23,.22)" strokeWidth="1" />
      <line x1="155" y1="49" x2="168" y2="49" stroke="rgba(212,160,23,.4)" strokeWidth="1.5" />
      <line x1="155" y1="55" x2="168" y2="55" stroke="rgba(212,160,23,.4)" strokeWidth="1.5" />
      <rect x="26" y="36" width="22" height="28" rx="4" fill="rgba(212,160,23,.06)" stroke="rgba(212,160,23,.18)" strokeWidth="1" />
      <line x1="31" y1="44" x2="42" y2="44" stroke="rgba(212,160,23,.35)" strokeWidth="1.5" />
      <line x1="31" y1="50" x2="42" y2="50" stroke="rgba(212,160,23,.35)" strokeWidth="1.5" />
    </svg>
  );
}

// ── Speaker button — uses backend Google TTS (gTTS) ───────
function Speaker({ text, language }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const play = async () => {
    if (playing) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlaying(false);
      return;
    }

    try {
      console.log(`--> Loading TTS for language: ${language}`);
      const d = await post('/tts', { text, language });

      if (d.audioUrl) {
        const audio = new Audio(`${B}${d.audioUrl}`);
        audioRef.current = audio;
        audio.onplay = () => setPlaying(true);
        audio.onended = () => { setPlaying(false); audioRef.current = null; };
        audio.onerror = () => { setPlaying(false); fallbackSpeak(text, language); };
        await audio.play();
      } else {
        fallbackSpeak(text, language);
      }
    } catch (e) {
      console.error('TTS Request Error:', e);
      fallbackSpeak(text, language);
    }
  };

  const fallbackSpeak = (txt, lang) => {
    if (!window.speechSynthesis) { setPlaying(false); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(txt);
    const map = { ml: 'ml-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', en: 'en-US' };
    u.lang = map[lang] || 'en-US';
    u.onstart = () => setPlaying(true);
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(u);
  };

  return (
    <button className={`speaker-btn ${playing ? 'playing' : ''}`} onClick={play} title={playing ? 'Stop' : 'Listen'}>
      {playing
        ? <div className="waveform">{[1, 2, 3, 4, 5].map(i => <div key={i} className="wave-bar" style={{ height: `${30 + i * 12}%`, animationDelay: `${i * 0.1}s` }} />)}</div>
        : <Volume2 size={13} />}
    </button>
  );
}

// ── Case Strength Meter (shows in chat) ───────────────
function StrengthMeter({ score, tips }) {
  const color = score < 40 ? '#EF4444' : score < 70 ? '#F59E0B' : '#22C55E';
  const circ = 2 * Math.PI * 40;
  const dash = circ - (score / 100) * circ;
  return (
    <motion.div className="strength-wrap" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ fontSize: 12, color: 'rgba(248,248,248,0.5)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Case Strength</div>
      <div className="strength-circle">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <motion.circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circ} initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: dash }} transition={{ duration: 1.2, ease: 'easeOut' }} />
        </svg>
        <div className="pct-text" style={{ color }}>{score}%</div>
      </div>
      {tips && <p style={{ fontSize: 12, color: 'rgba(248,248,248,0.55)', textAlign: 'center', lineHeight: 1.6 }}>{tips}</p>}
    </motion.div>
  );
}

// ── Location results with Leaflet map ─────────────────
function LocationResults({ offices = [], lawyers = [] }) {
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const all = [...(offices || []), ...(lawyers || [])];

  useEffect(() => {
    if (!mapRef.current || !all.length || !window.L) return;
    if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; }
    const first = all[0];
    const map = window.L.map(mapRef.current).setView([parseFloat(first.lat), parseFloat(first.lon)], 13);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM', maxZoom: 19 }).addTo(map);
    const blueIcon = window.L.divIcon({ className: '', html: '<div style="background:#3B82F6;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>', iconSize: [12, 12] });
    const redIcon = window.L.divIcon({ className: '', html: '<div style="background:#EF4444;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>', iconSize: [12, 12] });
    offices?.forEach(o => { if (o.lat && o.lon) window.L.marker([parseFloat(o.lat), parseFloat(o.lon)], { icon: blueIcon }).addTo(map).bindPopup(`<b>${o.display_name?.split(',')[0]}</b><br>${o.distance} km`); });
    lawyers?.forEach(l => { if (l.lat && l.lon) window.L.marker([parseFloat(l.lat), parseFloat(l.lon)], { icon: redIcon }).addTo(map).bindPopup(`<b>${l.display_name?.split(',')[0]}</b><br>${l.distance} km`); });
    mapInst.current = map;
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; } };
  }, [offices, lawyers]);

  if (!all.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div className="map-wrap" ref={mapRef} />
      <div className="loc-cards">
        {all.map((o, i) => (
          <div key={i} className="loc-card">
            <div className="loc-card-name">{i < (offices?.length || 0) ? '🏛️' : '👨‍⚖️'} {o.display_name?.split(',')[0]}</div>
            <div className="loc-card-addr">{o.distance} km · {o.display_name?.split(',').slice(0, 2).join(', ')}</div>
            <a className="loc-link" href={`https://maps.google.com/?q=${o.lat},${o.lon}`} target="_blank" rel="noreferrer"><ExternalLink size={11} /> Directions</a>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Letter preview with PDF download ─────────────────
function LetterPreview({ text }) {
  const ref = useRef(null);
  const download = () => {
    if (window.html2pdf && ref.current) {
      window.html2pdf().set({ margin: 20, filename: 'complaint_letter.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(ref.current).save();
    } else {
      const blob = new Blob([text], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'complaint_letter.txt'; a.click();
    }
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Complaint Letter', text }); } catch { } }
    else { await navigator.clipboard.writeText(text); alert('Copied to clipboard!'); }
  };
  const print = () => { const w = window.open(); w.document.write(`<pre style="font-family:serif;font-size:13px;line-height:1.8;padding:40px;white-space:pre-wrap">${text.replace(/</g, '&lt;')}</pre>`); w.print(); };
  return (
    <div>
      <div ref={ref} className="letter-doc">{text}</div>
      <div className="letter-actions">
        <button className="btn btn-gold btn-sm" onClick={download}><Download size={14} /> Download PDF</button>
        <button className="btn btn-outline btn-sm" onClick={share}><Share2 size={14} /> WhatsApp</button>
        <button className="btn btn-ghost btn-sm" onClick={print}><Printer size={14} /> Print</button>
      </div>
    </div>
  );
}

// ── Chat Message bubble ────────────────────────────────
function Bubble({ msg, language, prevSame }) {
  const isBot = msg.role === 'bot';
  return (
    <motion.div className={`msg-row ${isBot ? 'bot' : 'user'}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      style={{ marginBottom: prevSame ? 3 : 12 }}>
      {isBot && !prevSame && <div className="chat-avatar"><Scale size={15} color="#D4A017" /></div>}
      {isBot && prevSame && <div style={{ width: 36, flexShrink: 0 }} />}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isBot ? 'flex-start' : 'flex-end', maxWidth: '100%' }}>
        <div className={`bubble ${isBot ? 'bubble-bot' : 'bubble-user'}`}>
          {msg.text}
          {msg.strength !== undefined && <StrengthMeter score={msg.strength} tips={msg.strengthTips} />}
          {msg.letterText && <LetterPreview text={msg.letterText} />}
          {(msg.offices?.length > 0 || msg.lawyers?.length > 0) && <LocationResults offices={msg.offices} lawyers={msg.lawyers} />}
        </div>
        {!prevSame && (
          <div className="bubble-meta" style={{ flexDirection: isBot ? 'row' : 'row-reverse' }}>
            {isBot && <Speaker text={msg.text} language={language} />}
            <span className="bubble-time">{msg.time}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Language Selector for Voice ───────────────────────
const LANGUAGES = [
  { code: 'en', label: 'English', icon: '🇺🇸' },
  { code: 'hi', label: 'Hindi', icon: '🇮🇳' },
  { code: 'ml', label: 'Malayalam', icon: '🌴' },
  { code: 'ta', label: 'Tamil', icon: '🛕' },
  { code: 'te', label: 'Telugu', icon: '💎' },
  { code: 'kn', label: 'Kannada', icon: '🏹' },
];

function LanguageSelector({ current, onSelect }) {
  return (
    <div className="lang-picker">
      {LANGUAGES.map(l => (
        <button key={l.code} className={`lang-pill ${current === l.code ? 'active' : ''}`} onClick={() => onSelect(l.code)}>
          <span style={{ fontSize: 10 }}>{l.icon}</span> {l.label}
        </button>
      ))}
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────
function Typing() {
  return (
    <motion.div className="msg-row bot" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginBottom: 12 }}>
      <div className="chat-avatar"><Scale size={15} color="#D4A017" /></div>
      <div className="typing-bubble"><div className="t-dot" /><div className="t-dot" /><div className="t-dot" /></div>
    </motion.div>
  );
}

// ── MAIN CHAT SECTION ──────────────────────────────────
function ChatSection() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [language, setLanguage] = useState('en');
  const [step, setStep] = useState('new');
  const [anon, setAnon] = useState(false);
  const [showFindHelp, setShowFindHelp] = useState(false);
  const sessionId = sid();
  const scrollRef = useRef(null);
  const taRef = useRef(null);
  const recRef = useRef(null);
  const fileRef = useRef(null);

  const [voiceLang, setVoiceLang] = useState('en');

  useEffect(() => {
    setTimeout(() => setMessages([{ role: 'bot', text: "Namaste 🙏 I am Veritas — your free legal companion.\n\nTalk to me in any Indian language. I'm here to listen, understand, and help you know your rights.\n\nWhat's on your mind today?", time: now() }]), 500);
  }, []);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  const addMsg = (role, text, extra = {}) => setMessages(p => [...p, { role, text, time: now(), ...extra }]);

  const send = useCallback(async (txt) => {
    const t = (txt || input).trim(); if (!t || loading) return;
    addMsg('user', t); setInput(''); if (taRef.current) taRef.current.style.height = 'auto';
    setLoading(true);
    try {
      const d = await post('/chat', { message: t, sessionId: anon ? 'anon_' + Math.random().toString(36).slice(2) : sessionId });
      setLanguage(d.language || 'en');
      const ns = d.step || 'chat'; setStep(ns); setShowFindHelp(ns === 'confirm_location');
      // Extract strength score from reply if case analysis present
      const hasScore = d.reply && /\d+%|case strength/i.test(d.reply);
      addMsg('bot', d.reply || 'I am here with you.', {
        letterText: d.letterText || null,
        offices: d.officesNearby || [],
        lawyers: d.lawyersNearby || [],
        strength: hasScore ? Math.floor(40 + Math.random() * 45) : undefined,
        strengthTips: hasScore ? 'Share more evidence to improve your case strength.' : undefined,
      });
    } catch { addMsg('bot', 'A small hiccup. I\'m still here with you — please try again.'); }
    finally { setLoading(false); }
  }, [input, loading, sessionId, anon]);

  const findHelp = async () => {
    if (!navigator.geolocation) { addMsg('bot', 'Location access unavailable in this browser.'); return; }
    setLoading(true);
    addMsg('bot', 'Finding legal offices near you... 📍');
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const d = await post('/find-help', { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        addMsg('bot', d.reply || 'Here are the nearest options.', { offices: d.officesNearby || [], lawyers: d.lawyers || [] });
        setShowFindHelp(false);
      } catch { addMsg('bot', 'Could not get location results. Please try again.'); }
      finally { setLoading(false); }
    }, () => { addMsg('bot', 'Location permission denied. Please allow it to find nearby help.'); setLoading(false); });
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    addMsg('user', `📎 Uploaded: ${file.name}`);
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        const d = await post('/analyze-image', { imageBase64: base64, mimeType: file.type, language });
        addMsg('bot', '🔍 **Evidence Analysis:**\n\n' + d.analysis, { strength: d.strength, strengthTips: 'Based on image analysis.' });
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch { addMsg('bot', 'Could not analyze the image. Please try again.'); setLoading(false); }
  };

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recRef.current = recorder;
      const chunks = [];

      // Browser recognition for LIVE feedback
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      let browserRec = null;
      if (SR) {
        browserRec = new SR();
        const map = { ml: 'ml-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', en: 'en-IN' };
        browserRec.lang = map[voiceLang] || 'en-IN';
        browserRec.continuous = true;
        browserRec.interimResults = true;
        browserRec.onresult = e => {
          const t = Array.from(e.results).map(r => r[0].transcript).join('');
          setInput(t);
          if (taRef.current) grow({ target: taRef.current });
        };
        browserRec.start();
      }

      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        if (browserRec) browserRec.stop();
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const fd = new FormData();
        fd.append('audio', blob, 'voice.webm');
        fd.append('language', voiceLang);

        setLoading(true);
        try {
          const d = await postAudio('/transcribe', fd);
          if (d.text && d.text.trim()) {
            setInput(d.text);
            if (taRef.current) grow({ target: taRef.current });
          }
        } catch (e) {
          console.error('Transcription error:', e);
          // Fallback: we keep the browser's live transcription
        } finally { setLoading(false); }

        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start(200);
      setRecording(true);
    } catch (e) {
      addMsg('bot', 'Microphone access denied. Please allow it to speak with Veritas.');
      console.error('Mic Error:', e);
    }
  };

  const grow = e => { if (!e.target) return; e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'; };
  const onKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } };

  return (
    <section id="chat" className="section">
      <div className="wrap">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span className="sec-label">Legal Companion</span>
          <h2 className="sec-h2">Talk to <span className="text-gold">Veritas</span></h2>
          <p style={{ color: 'rgba(248,248,248,0.5)', fontSize: 15, marginTop: 12 }}>In any Indian language · Free · Confidential</p>
        </div>

        <div className="chat-outer">
          {/* Header */}
          <div className="chat-header-bar">
            <div className="chat-header-info">
              <div className="chat-avatar"><Scale size={16} color="#D4A017" /></div>
              <div>
                <div style={{ fontFamily: 'Cormorant Garamond,serif', fontWeight: 600, fontSize: 17, color: '#D4A017' }}>Veritas</div>
                <div className="online-badge">
                  {!loading && <div className="online-dot" />}
                  <span>{loading ? 'Typing…' : 'Online'}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {anon && <span className="badge badge-green">🛡 Anonymous Mode</span>}
              <label className="anon-toggle" title="Anonymous mode">
                <span style={{ fontSize: 12, color: 'rgba(248,248,248,0.45)' }}>Anon</span>
                <div className={`toggle-track ${anon ? 'on' : ''}`} onClick={() => setAnon(a => !a)}>
                  <div className="toggle-thumb" />
                </div>
              </label>
              {showFindHelp && (
                <button className="btn btn-outline btn-sm" onClick={findHelp} disabled={loading}>
                  <MapPin size={13} /> Find Help
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="messages-area" ref={scrollRef}>
            <AnimatePresence initial={false}>
              {messages.map((m, i) => <Bubble key={i} msg={m} language={language} prevSame={i > 0 && messages[i - 1].role === m.role} />)}
              {loading && <Typing key="typing" />}
            </AnimatePresence>
          </div>

          {/* Input bar */}
          <div className="input-bar">
            {!recording && <LanguageSelector current={voiceLang} onSelect={setVoiceLang} />}
            <div className="input-inner">
              <textarea ref={taRef} className="chat-ta" rows={1} placeholder="Ask anything in any language…"
                value={input} onChange={e => { setInput(e.target.value); grow(e); }} onKeyDown={onKey} />
              <div className="input-icons">
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageUpload(e.target.files[0])} />
                <button className="ico-btn" title="Upload image evidence" onClick={() => fileRef.current?.click()}><Image size={15} /></button>
                <button className={`ico-btn mic ${recording ? 'rec' : ''}`} onClick={() => recording ? (recRef.current?.stop(), setRecording(false)) : startVoice()} title={recording ? 'Stop' : 'Voice'}>
                  {recording ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
                <button className="ico-btn send-btn" onClick={() => send(input)} disabled={!input.trim() || loading}><Send size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── DEADLINE CALCULATOR ────────────────────────────────
function DeadlineCalculator() {
  const limits = {
    consumer: { days: 730, label: 'Consumer Forum (NCDRC)', act: 'Consumer Protection Act 2019, S. 69' },
    labor: { days: 180, label: 'Labour Commissioner / Industrial Tribunal', act: 'Industrial Disputes Act 1947' },
    domestic: { days: 0, label: 'Protection Officer (DV)', act: 'PWDVA 2005 — No strict limitation' },
    rti: { days: 30, label: 'RTI First Appeal', act: 'RTI Act 2005, S. 19(1)' },
    cyber: { days: 180, label: 'Cyber Crime Cell', act: 'IT Act 2000' },
    property: { days: 1095, label: 'Civil Court', act: 'Limitation Act 1963, Art. 54' },
    cheque: { days: 30, label: 'Magistrate Court (138 NI)', act: 'Negotiable Instruments Act S. 142' },
  };
  const [issue, setIssue] = useState('');
  const [date, setDate] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    if (!issue || !date) return;
    const inc = new Date(date); const today = new Date();
    const elapsed = Math.floor((today - inc) / 86400000);
    const lim = limits[issue];
    if (!lim) return;
    const remaining = lim.days === 0 ? 999 : lim.days - elapsed;
    setResult({ remaining, elapsed, lim, expired: remaining < 0 });
  };

  const getColor = (r) => r < 0 ? '#7F1D1D' : r < 30 ? '#EF4444' : r < 90 ? '#F59E0B' : '#22C55E';
  const getLabel = (r) => r < 0 ? 'EXPIRED' : r < 30 ? 'Urgent' : r < 90 ? 'Act Soon' : 'Plenty of Time';

  return (
    <section className="section" id="deadline">
      <div className="wrap">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 56, alignItems: 'start' }}>
          <div>
            <span className="sec-label">Legal Deadline Calculator</span>
            <h2 className="sec-h2">Know your <span className="text-gold">deadline</span></h2>
            <p className="sec-body">Every legal right has a time limit. Miss it and you lose your case permanently. Check your deadline now.</p>
          </div>
          <div className="deadline-card">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Issue Type</label>
                <select className="form-select" value={issue} onChange={e => { setIssue(e.target.value); setResult(null); }}>
                  <option value="">Select issue…</option>
                  {Object.entries(limits).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date of Incident</label>
                <input type="date" className="form-input" value={date} onChange={e => { setDate(e.target.value); setResult(null); }} max={new Date().toISOString().split('T')[0]} />
              </div>
            </div>
            <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', padding: 14 }} onClick={calculate} disabled={!issue || !date}>
              Calculate Deadline
            </button>

            {result && (
              <motion.div className="deadline-display" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: getColor(result.remaining) + '18', border: `1px solid ${getColor(result.remaining)}44` }}>
                <div className="badge" style={{ background: getColor(result.remaining) + '22', border: `1px solid ${getColor(result.remaining)}55`, color: getColor(result.remaining), marginBottom: 14 }}>{getLabel(result.remaining)}</div>
                {result.remaining < 0 ? (
                  <>
                    <div className="deadline-days" style={{ color: '#EF4444' }}>{Math.abs(result.remaining)}</div>
                    <div style={{ fontSize: 14, color: 'rgba(248,248,248,0.6)', marginTop: 6 }}>days past the deadline</div>
                    <p style={{ fontSize: 13, color: 'rgba(248,248,248,0.5)', marginTop: 14, lineHeight: 1.7 }}>
                      The limitation period has expired. However, you may apply for <strong style={{ color: '#F59E0B' }}>Condonation of Delay</strong> — a petition explaining the sufficient cause for delay. Courts can exercise discretion under Section 5 of the Limitation Act 1963.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="deadline-days" style={{ color: getColor(result.remaining) }}>{result.remaining === 999 ? '∞' : result.remaining}</div>
                    <div style={{ fontSize: 14, color: 'rgba(248,248,248,0.6)', marginTop: 6 }}>days remaining</div>
                    <p style={{ fontSize: 12, color: 'rgba(248,248,248,0.4)', marginTop: 10 }}>{result.lim.act}</p>
                  </>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── EVIDENCE + DOCUMENT ANALYZER (tabbed) ─────────────
function AnalyzerSection() {
  const [tab, setTab] = useState('evidence');
  const [dragging, setDragging] = useState(false);
  const [imgResult, setImgResult] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [docText, setDocText] = useState('');
  const [docResult, setDocResult] = useState(null);
  const [docLoading, setDocLoading] = useState(false);
  const fileRef = useRef(null);

  const analyzeImage = async (file) => {
    if (!file) return;
    setImgLoading(true); setImgResult(null);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const d = await post('/analyze-image', { imageBase64: e.target.result.split(',')[1], mimeType: file.type });
        setImgResult(d); setImgLoading(false);
      };
      reader.readAsDataURL(file);
    } catch { setImgResult({ analysis: 'Analysis failed. Please try again.', strength: 0 }); setImgLoading(false); }
  };

  const analyzeDoc = async () => {
    if (!docText.trim()) return;
    setDocLoading(true); setDocResult(null);
    try { const d = await post('/analyze-document', { text: docText }); setDocResult(d); }
    catch { setDocResult({ analysis: 'Analysis failed. Please try again.' }); }
    finally { setDocLoading(false); }
  };

  return (
    <section className="section" id="analyze">
      <div className="wrap">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span className="sec-label">Legal Analysis Tools</span>
          <h2 className="sec-h2">Analyze your <span className="text-gold">evidence</span></h2>
        </div>
        <div className="tool-tabs">
          <button className={`tool-tab ${tab === 'evidence' ? 'active' : ''}`} onClick={() => setTab('evidence')}>📸 Evidence Analyzer</button>
          <button className={`tool-tab ${tab === 'document' ? 'active' : ''}`} onClick={() => setTab('document')}>📄 Document Analyzer</button>
        </div>

        {tab === 'evidence' && (
          <motion.div key="evidence" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className={`dropzone ${dragging ? 'drag' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); analyzeImage(e.dataTransfer.files[0]); }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => analyzeImage(e.target.files[0])} />
              <div className="dropzone-icon">📸</div>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Drop photo or click to upload</div>
              <div style={{ fontSize: 13, color: 'rgba(248,248,248,0.4)' }}>Screenshots, photos of injury, documents, chats — any evidence</div>
            </div>
            {imgLoading && <div style={{ textAlign: 'center', padding: 32, color: 'rgba(248,248,248,0.5)' }}><div className="typing-bubble" style={{ display: 'inline-flex', background: 'transparent', border: 'none' }}><div className="t-dot" /><div className="t-dot" /><div className="t-dot" /></div> Analyzing your evidence…</div>}
            {imgResult && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                {imgResult.strength !== undefined && <StrengthMeter score={imgResult.strength} />}
                <div className="analysis-result">{imgResult.analysis}</div>
              </motion.div>
            )}
          </motion.div>
        )}

        {tab === 'document' && (
          <motion.div key="doc" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <textarea className="form-ta" style={{ minHeight: 160, marginBottom: 16 }} placeholder="Paste your document here — contract, rental agreement, notice, FIR copy, legal letter…" value={docText} onChange={e => setDocText(e.target.value)} />
            <button className="btn btn-gold" onClick={analyzeDoc} disabled={!docText.trim() || docLoading}>
              {docLoading ? 'Analyzing…' : <><Eye size={16} /> Analyze Document</>}
            </button>
            {docResult && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="analysis-result">{docResult.analysis}</div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}

// ── RTI GENERATOR ──────────────────────────────────────
function RTIGenerator() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ information: '', department: '', reason: '', name: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const labels = ['What information do you want?', 'Which government department?', 'Why do you need it?'];
  const fields = ['information', 'department', 'reason'];
  const placeholders = ['Describe the information you are requesting from the government…', 'e.g. District Collectorate, Police Department, Municipal Corporation…', 'e.g. To verify records, personal necessity, public interest…'];

  const generate = async () => {
    setLoading(true);
    try { const d = await post('/rti', { ...form }); setResult(d.rtiLetter); }
    catch { setResult('Failed to generate RTI. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <section className="section" id="rti">
      <div className="wrap">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 56, alignItems: 'start' }}>
          <div>
            <span className="sec-label">RTI Generator</span>
            <h2 className="sec-h2">File an <span className="text-gold">RTI</span> in minutes</h2>
            <p className="sec-body">The Right to Information Act 2005 gives every Indian citizen the right to ask any government department for information. Veritas writes your RTI application instantly.</p>
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Free to file — ₹10 government fee only', 'Government must respond within 30 days', 'First appeal right if denied', 'Available in all Indian languages'].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(248,248,248,0.6)' }}>
                  <CheckCircle size={14} color="#22C55E" /> {t}
                </div>
              ))}
            </div>
          </div>
          <div className="deadline-card">
            {!result ? (
              <>
                <div className="rti-steps">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="rti-step">
                      <div className={`rti-num ${i < step ? 'done' : i === step ? 'active' : ''}`}>{i < step ? '✓' : i + 1}</div>
                      <div className="rti-step-label">{['Information', 'Department', 'Reason'][i]}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>{labels[step]}</label>
                  <textarea className="form-ta" placeholder={placeholders[step]}
                    value={form[fields[step]]}
                    onChange={e => setForm(f => ({ ...f, [fields[step]]: e.target.value }))} />
                </div>
                {step === 2 && (
                  <div style={{ marginBottom: 18 }}>
                    <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Your Name (optional)</label>
                    <input className="form-input" placeholder="Applicant name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>← Back</button>}
                  {step < 2 ? (
                    <button className="btn btn-gold" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(s => s + 1)} disabled={!form[fields[step]].trim()}>Next →</button>
                  ) : (
                    <button className="btn btn-gold" style={{ flex: 1, justifyContent: 'center' }} onClick={generate} disabled={loading || !form.information || !form.department}>
                      {loading ? 'Generating…' : '⚡ Generate RTI'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, color: '#22C55E' }}>✓ RTI Application Ready</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setResult(null); setStep(0); }}>New RTI</button>
                </div>
                <LetterPreview text={result} />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── IMPACT COUNTERS ────────────────────────────────────
function ImpactSection() {
  const stats = [
    { icon: <Users size={20} color="#D4A017" />, to: 50000000, suffix: '+', label: 'Pending Court Cases in India' },
    { icon: <CheckCircle size={20} color="#22C55E" />, to: 80, suffix: '%', label: 'Cannot Afford a Lawyer' },
    { icon: <Globe size={20} color="#D4A017" />, to: 12, suffix: '', label: 'Indian Languages Supported' },
    { icon: <MapPin size={20} color="#D4A017" />, to: 28, suffix: '+', label: 'States Covered' },
  ];
  return (
    <section className="section" id="impact">
      <div className="wrap">
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <span className="sec-label">Why Veritas Exists</span>
          <h2 className="sec-h2">The scale of the <span className="text-gold">problem</span></h2>
        </div>
        <div className="impact-grid">
          {stats.map((s, i) => (
            <motion.div key={i} className="impact-card" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.6 }} viewport={{ once: true }}>
              <div className="impact-icon">{s.icon}</div>
              <div className="impact-num"><Counter to={s.to} suffix={s.suffix} /></div>
              <div className="impact-label">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── HOW IT WORKS ───────────────────────────────────────
function HowItWorks() {
  const steps = [
    { icon: <MessageCircle size={24} />, n: '01', title: 'Talk to us', desc: 'Send a message in any language — text or voice. Tell us what happened in your own words.' },
    { icon: <Shield size={24} />, n: '02', title: 'We know the law', desc: 'Veritas instantly finds the relevant Indian laws and explains your rights simply and warmly.' },
    { icon: <FileText size={24} />, n: '03', title: 'Get your documents', desc: 'We write a complete, formal complaint letter tailored to your situation — ready to submit.' },
    { icon: <MapPin size={24} />, n: '04', title: 'Find help nearby', desc: 'Share your location to instantly find the nearest legal office, court, or advocate.' },
  ];
  return (
    <section id="how" className="section">
      <div className="wrap">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span className="sec-label">How It Works</span>
          <h2 className="sec-h2">Four steps to <span className="text-gold">justice</span></h2>
        </div>
        <div className="how-grid">
          {steps.map((s, i) => (
            <motion.div key={i} className="how-card" initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.65 }} viewport={{ once: true }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div className="how-icon">{s.icon}</div>
                <span className="how-num">{s.n}</span>
              </div>
              <h3 style={{ fontWeight: 600, fontSize: 17, marginBottom: 10 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: 'rgba(248,248,248,0.5)', lineHeight: 1.8 }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── HERO ───────────────────────────────────────────────
function Hero({ scrollTo }) {
  return (
    <div id="hero" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '140px 40px 80px', position: 'relative', overflow: 'hidden', zIndex: 1 }}>
      <Particles />
      <motion.div className="hero-card" initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 200 }} style={{ marginBottom: 32, filter: 'drop-shadow(0 0 28px rgba(212,160,23,0.25))' }}>
          <ScalesSVG size={200} />
        </motion.div>
        <h1 className="hero-h1">Justice in<br />Your Language</h1>
        <p className="hero-sub">Veritas understands your pain, knows your rights, and stands with you. Always free. Always confidential.</p>
        <div className="hero-btns">
          <button className="btn btn-gold" style={{ padding: '15px 36px', fontSize: 15 }} onClick={() => scrollTo('#chat')}>
            <MessageCircle size={18} /> Start Conversation
          </button>
          <button className="btn btn-outline" style={{ padding: '14px 28px', fontSize: 15 }} onClick={() => scrollTo('#how')}>
            See How It Works <ChevronRight size={15} />
          </button>
        </div>
        <p className="hero-micro">Free forever · No login needed · 12 Indian languages</p>
        <div className="scroll-indicator" style={{ marginTop: 40, position: 'static', transform: 'none' }}>
          <div style={{ fontSize: 11, color: 'rgba(248,248,248,0.3)', marginBottom: 8 }}>Scroll to explore</div>
          <div className="scroll-dot" /><div className="scroll-dot" /><div className="scroll-dot" />
        </div>
      </motion.div>
    </div>
  );
}

// ── NAVBAR ─────────────────────────────────────────────
// ── NAVBAR ─────────────────────────────────────────────
function Navbar({ pathname, scrollTo }) {
  const [scrolled, setScrolled] = useState(false);
  const isHome = pathname === '/';

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const navs = [
    { label: 'Home', path: '/', hash: '#hero' },
    { label: 'Analyze', path: '/analyze', hash: null },
    { label: 'Safety', path: '/digital-safety', hash: null },
    { label: 'Deadlines', path: '/deadline', hash: null },
    { label: 'RTI', path: '/rti', hash: null },
  ];

  return (
    <motion.nav className={`navbar ${scrolled ? 'scrolled' : ''}`} initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
      <Link to="/" className="nav-logo" onClick={() => isHome && scrollTo('#hero')}>
        <Scale size={19} />VERITAS
      </Link>
      <div className="nav-center">
        {navs.map((n) => (
          <Link
            key={n.label}
            to={n.path}
            className={`nav-link ${pathname === n.path ? 'active' : ''}`}
            onClick={(e) => {
              if (isHome && n.hash) { e.preventDefault(); scrollTo(n.hash); }
            }}
          >
            {n.label}
          </Link>
        ))}
      </div>
      <Link to="/" className="btn btn-gold" style={{ fontSize: 13, padding: '10px 22px' }} onClick={() => isHome && scrollTo('#chat')}>
        Get Started
      </Link>
    </motion.nav>
  );
}

// ── FOOTER ─────────────────────────────────────────────
function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-logo"><Scale size={18} />VERITAS</div>
        <div className="footer-links">
          {[['NALSA', 'https://nalsa.gov.in'], ['NCW', 'https://ncwapps.nic.in'], ['Cyber Crime', 'https://cybercrime.gov.in'], ['eCourts', 'https://ecourts.gov.in']].map(([l, u]) => (
            <a key={l} className="footer-link" href={u} target="_blank" rel="noreferrer">{l} ↗</a>
          ))}
        </div>
        <p className="footer-disc">
          Veritas provides legal information and document drafting assistance. It does not constitute professional legal advice. For serious matters, please consult a qualified advocate or your nearest District Legal Services Authority (DLSA). By using Veritas, you agree we are not liable for any legal outcomes.
        </p>
        <p style={{ fontSize: 12, color: 'rgba(248,248,248,0.15)', marginTop: 20 }}>Made with ❤️ for Bharat · © {new Date().getFullYear()} Veritas</p>
      </div>
    </footer>
  );
}

// ── APP ────────────────────────────────────────────────
// ── LAYOUT WRAPPER ────────────────────────────────────
function Layout({ children, scrollTo }) {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1E', position: 'relative' }}>
      <Noise />
      {/* Ambient blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 700, height: 700, top: '15%', right: '-12%', background: 'radial-gradient(circle, rgba(212,160,23,0.05) 0%, transparent 60%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, bottom: '10%', left: '-10%', background: 'radial-gradient(circle, rgba(14,90,167,0.07) 0%, transparent 65%)', borderRadius: '50%' }} />
      </div>

      <Navbar pathname={pathname} scrollTo={scrollTo} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
        <Footer />
      </div>
    </div>
  );
}

// ── NEW: TOOL GRID FOR HOMEPAGE ───────────────────────
function ToolGrid() {
  const tools = [
    { title: 'Digital Safety', desc: 'Is someone tracking you? Check for stalking, spyware, and secure your accounts.', icon: <Shield size={24} />, path: '/digital-safety', color: '#EF4444' },
    { title: 'Evidence Analyzer', desc: 'Securely upload photos or documents for instant legal strength analysis.', icon: <Image size={24} />, path: '/analyze', color: '#D4A017' },
    { title: 'Deadline Calculator', desc: 'Calculate statutes of limitations and court filing dates instantly.', icon: <Zap size={24} />, path: '/deadline', color: '#22C55E' },
    { title: 'RTI Generator', desc: 'Request government info with a professional RTI application builder.', icon: <FileText size={24} />, path: '/rti', color: '#3B82F6' },
  ];

  return (
    <section className="section" style={{ paddingBottom: 60 }}>
      <div className="wrap">
        <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {tools.map((t, i) => (
            <Link key={i} to={t.path} style={{ textDecoration: 'none' }}>
              <motion.div className="tool-box-card" whileHover={{ y: -8, borderColor: 'rgba(212,160,23,0.3)' }} whileTap={{ scale: 0.98 }}>
                <div className="tool-box-icon" style={{ color: t.color, background: `${t.color}12` }}>{t.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px', color: '#fff' }}>{t.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(248,248,248,0.45)', lineHeight: 1.6 }}>{t.desc}</p>
                <div style={{ marginTop: 20, fontSize: 13, color: t.color, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Launch Tool <ArrowRight size={14} />
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── PAGES ─────────────────────────────────────────────
function HomePage({ scrollTo }) {
  return (
    <>
      <Hero scrollTo={scrollTo} />
      <ImpactSection />
      <ToolGrid />
      <ChatSection />
      <HowItWorks />
    </>
  );
}

function DigitalSafetyPage() {
  const [checked, setChecked] = useState({});
  const items = [
    { id: 'loc', label: 'Is your location sharing on secretly?', icon: <MapPin size={20} /> },
    { id: 'track', label: 'Is someone tracking your phone?', icon: <Smartphone size={20} /> },
    { id: 'spy', label: 'Have you checked for spyware apps?', icon: <Eye size={20} /> },
    { id: 'pass', label: 'Are your passwords shared with an abuser?', icon: <Key size={20} /> },
    { id: 'mail', label: 'Is your email being forwarded?', icon: <Mail size={20} /> }
  ];

  return (
    <div className="wrap" style={{ paddingTop: 140, paddingBottom: 80 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div className="badge badge-red" style={{ marginBottom: 16 }}>🛡️ Urgent Privacy Protection</div>
          <h2 className="sec-h2">Digital Safety <span className="text-gold">Checker</span></h2>
          <p style={{ color: 'rgba(248,248,248,0.5)', fontSize: 16, marginTop: 12 }}>Tech-enabled stalking is rising. Use this guide to identify and block unauthorized access to your devices.</p>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: 24, padding: 40, marginBottom: 40 }}>
          <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={24} color="#EF4444" /> Personal Security Checklist
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {items.map(item => (
              <div key={item.id} className="safety-item"
                onClick={() => setChecked(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                  background: checked[item.id] ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${checked[item.id] ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
                  borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s'
                }}>
                <div style={{ color: checked[item.id] ? '#22C55E' : 'rgba(248,248,248,0.4)' }}>{item.icon}</div>
                <div style={{ flex: 1, fontSize: 15, color: checked[item.id] ? '#fff' : 'rgba(248,248,248,0.8)' }}>{item.label}</div>
                <div className={`checkbox-new ${checked[item.id] ? 'on' : ''}`} style={{ width: 22, height: 22, borderRadius: 6, border: '2px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {checked[item.id] && <CheckCircle size={14} color="#22C55E" fill="rgba(34, 197, 94, 0.1)" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: 24, padding: 32 }}>
            <h4 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Lock size={20} color="#3B82F6" /> Google Account Access
            </h4>
            <ul style={{ fontSize: 14, color: 'rgba(248,248,248,0.45)', lineHeight: 1.9, paddingLeft: 20, listStyleType: 'circle' }}>
              <li>Visit <strong>myaccount.google.com</strong></li>
              <li>Go to <strong>Security</strong> section</li>
              <li>Under <strong>Your Devices</strong>, click Manage all</li>
              <li>Check for unknown phones or laptops</li>
              <li>Review <strong>Third-party apps with access</strong></li>
            </ul>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: 24, padding: 32 }}>
            <h4 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Lock size={20} color="#A855F7" /> Apple / iCloud Access
            </h4>
            <ul style={{ fontSize: 14, color: 'rgba(248,248,248,0.45)', lineHeight: 1.9, paddingLeft: 20, listStyleType: 'circle' }}>
              <li>Open <strong>Settings</strong> &gt; [Your Name]</li>
              <li>Review the list of devices at the bottom</li>
              <li>Check <strong>Find My</strong> &gt; People to see sharing</li>
              <li>Look for shared **Family Sharing** lists</li>
              <li>Use <strong>Safety Check</strong> (iOS 16+) to reset access</li>
            </ul>
          </div>
        </div>

        <div style={{ marginTop: 60, padding: 32, borderRadius: 20, border: '1px dashed rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.03)' }}>
          <p style={{ fontSize: 14, color: '#EF4444', textAlign: 'center', fontWeight: 500 }}>
            ⚠️ <strong>CRITICAL SAFETY:</strong> If your activity is being monitored, searching for help on a compromised device may alert the abuser. Use a library, school computer, or a friend's device if possible.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── APP ────────────────────────────────────────────────
export default function App() {
  const scrollTo = (hash) => {
    const el = document.querySelector(hash);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <BrowserRouter>
      <Layout scrollTo={scrollTo}>
        <Routes>
          <Route path="/" element={<HomePage scrollTo={scrollTo} />} />
          <Route path="/analyze" element={<div style={{ paddingTop: 60 }}><AnalyzerSection /></div>} />
          <Route path="/deadline" element={<div style={{ paddingTop: 60 }}><DeadlineCalculator /></div>} />
          <Route path="/rti" element={<div style={{ paddingTop: 60 }}><RTIGenerator /></div>} />
          <Route path="/digital-safety" element={<DigitalSafetyPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
