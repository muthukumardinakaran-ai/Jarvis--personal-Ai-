import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowUp, Bot, CalendarClock, Check, ChevronDown, Cpu, ExternalLink,
  Globe2, Mic, MicOff, Plus, Settings, ShieldCheck, Smartphone, Sparkles, Trash2,
  Volume2, VolumeX, X, Zap
} from 'lucide-react';
import { askAI, getSettings, parseLocalCommand } from './assistant';
import { LocalNotifications } from '@capacitor/local-notifications';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const initialMessages = [{
  id: uid(), role: 'assistant',
  content: 'Vanakkam! I’m JARVIS, your personal AI assistant. You can type or use the mic, create reminders, and connect an AI model in Settings. / வணக்கம்! எப்படி உதவலாம்?'
}];

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function localDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function App() {
  const [messages, setMessages] = useState(() => load('jarvis_messages', initialMessages));
  const [reminders, setReminders] = useState(() => load('jarvis_reminders', []));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [endpoint, setEndpoint] = useState(() => getSettings().endpoint);
  const [apiKey, setApiKey] = useState(() => getSettings().apiKey);
  const [model, setModel] = useState(() => getSettings().model);
  const [language, setLanguage] = useState(() => getSettings().language);
  const [voiceReply, setVoiceReply] = useState(() => localStorage.getItem('jarvis_voice_reply') !== 'false');
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [notice, setNotice] = useState('');
  const chatEnd = useRef(null);
  const recognitionRef = useRef(null);
  const native = useMemo(() => !!window.Capacitor?.isNativePlatform?.(), []);

  useEffect(() => { localStorage.setItem('jarvis_messages', JSON.stringify(messages.slice(-80))); }, [messages]);
  useEffect(() => { localStorage.setItem('jarvis_reminders', JSON.stringify(reminders)); }, [reminders]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy, activeTab]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setReminders(old => {
        const due = old.filter(r => !r.done && new Date(r.at).getTime() <= now);
        if (due.length) {
          due.forEach(r => {
            showNotice(`Reminder: ${r.title}`);
            speak(`Reminder. ${r.title}`);
          });
          return old.map(r => due.some(d => d.id === r.id) ? { ...r, done: true } : r);
        }
        return old;
      });
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 5000);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('JARVIS Personal AI', { body: message }); } catch {}
    }
  }

  function speak(text) {
    if (!voiceReply || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = language === 'ta' ? 'ta-IN' : language === 'en' ? 'en-IN' : /[\u0B80-\u0BFF]/.test(text) ? 'ta-IN' : 'en-IN';
    utterance.lang = lang;
    utterance.rate = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) return showNotice('Notifications are not supported in this browser.');
    const result = await Notification.requestPermission();
    showNotice(result === 'granted' ? 'Notifications enabled while the browser/app supports them.' : 'Notification permission was not granted.');
  }

  async function addReminder(title, at) {
    if (!title.trim() || !at) return;
    const date = new Date(at);
    if (date.getTime() <= Date.now()) return showNotice('Choose a future time for this reminder.');
    const reminder = { id: uid(), title: title.trim(), at: date.toISOString(), done: false };
    setReminders(old => [...old, reminder].sort((a, b) => new Date(a.at) - new Date(b.at)));
    if (native) {
      try {
        await LocalNotifications.requestPermissions();
        await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Date.now() % 2147483000), title: 'JARVIS Reminder', body: reminder.title, schedule: { at: date } }] });
      } catch (e) { console.warn('Native notification scheduling unavailable', e); }
    }
    setReminderTitle('');
    setReminderTime('');
    setReminderOpen(false);
    showNotice('Reminder saved. Background delivery depends on platform permissions.');
  }

  function handleShortcut(command) {
    if (command.type === 'open-url') {
      window.open(command.url, '_blank', 'noopener,noreferrer');
      return `Opening ${command.url}.`;
    }
    if (command.type === 'settings') {
      if (native && window.Capacitor?.Plugins?.App?.openUrl) {
        return 'Android settings shortcut is not wired in this starter yet. Use your phone Settings app, or add a native Android intent bridge.';
      }
      return 'For security, a browser cannot open Android system settings directly. Use your device Settings app.';
    }
    if (command.type === 'reminder-time') {
      const d = new Date();
      d.setHours(command.hour, command.minute, 0, 0);
      if (d <= new Date()) d.setDate(d.getDate() + 1);
      setReminderTitle(command.original.replace(/remind me|reminder|நினைவூட்டு|nyabagam|niyabagam/ig, '').trim() || command.original);
      setReminderTime(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      setReminderOpen(true);
      return 'I prepared a reminder time. Please confirm the title and save it.';
    }
    return '';
  }

  async function sendMessage(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;
    setInput('');
    const userMessage = { id: uid(), role: 'user', content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    const command = parseLocalCommand(text);
    if (command) {
      const reply = handleShortcut(command);
      if (reply) {
        setMessages(old => [...old, { id: uid(), role: 'assistant', content: reply }]);
        speak(reply);
        return;
      }
    }
    setBusy(true);
    try {
      const history = nextMessages.slice(-16).map(m => ({ role: m.role, content: m.content }));
      const reply = await askAI(history);
      setMessages(old => [...old, { id: uid(), role: 'assistant', content: reply }]);
      speak(reply);
    } catch (error) {
      const reply = `I couldn't reach the AI service. ${error.message}. Check Settings, the endpoint, network access, and CORS configuration.`;
      setMessages(old => [...old, { id: uid(), role: 'assistant', content: reply }]);
    } finally {
      setBusy(false);
    }
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showNotice('Speech recognition is not supported here. Try Chrome on Android, or type your message.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = language === 'ta' ? 'ta-IN' : language === 'en' ? 'en-IN' : 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;
    setListening(true);
    let finalText = '';
    recognition.onresult = event => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      setInput((finalText + interim).trim());
    };
    recognition.onerror = () => { setListening(false); showNotice('Voice recognition stopped. Check microphone permission and try again.'); };
    recognition.onend = () => {
      setListening(false);
      if (finalText.trim()) sendMessage(finalText.trim());
    };
    recognition.start();
  }

  function saveSettings() {
    localStorage.setItem('jarvis_endpoint', endpoint.trim());
    localStorage.setItem('jarvis_api_key', apiKey.trim());
    localStorage.setItem('jarvis_model', model.trim());
    localStorage.setItem('jarvis_language', language);
    localStorage.setItem('jarvis_voice_reply', String(voiceReply));
    setSettingsOpen(false);
    showNotice('Settings saved on this device.');
  }

  function clearChat() {
    setMessages([{ id: uid(), role: 'assistant', content: 'Chat cleared. Vanakkam! What would you like to do?' }]);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Cpu size={24}/></div><div><strong>JARVIS</strong><span>PERSONAL AI</span></div></div>
      <div className="status"><span className="status-dot"></span> Assistant ready</div>
      <nav>
        <button className={activeTab === 'chat' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab('chat')}><Bot size={18}/> AI Assistant</button>
        <button className={activeTab === 'reminders' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab('reminders')}><CalendarClock size={18}/> Reminders <span className="nav-count">{reminders.filter(r => !r.done).length}</span></button>
        <button className="nav-item" onClick={() => setSettingsOpen(true)}><Settings size={18}/> Settings</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="privacy-card"><ShieldCheck size={17}/><div><b>Your data, your choice</b><p>Chat and reminders are stored locally in this browser.</p></div></div>
        <div className="version">VERSION 0.1.0 · STARTER</div>
      </div>
    </aside>

    <main className="main-panel">
      <header className="topbar">
        <div className="mobile-brand"><div className="brand-mark"><Cpu size={20}/></div><strong>JARVIS</strong></div>
        <div className="top-status"><span className="live-dot"></span> PERSONAL SYSTEM ONLINE</div>
        <div className="top-actions"><button className="icon-button" title="Voice replies" onClick={() => { setVoiceReply(v => !v); localStorage.setItem('jarvis_voice_reply', String(!voiceReply)); }}>{voiceReply ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button><button className="icon-button" title="Settings" onClick={() => setSettingsOpen(true)}><Settings size={18}/></button></div>
      </header>

      {activeTab === 'chat' ? <section className="chat-view">
        <div className="hero">
          <div className="orb-wrap"><div className="orb-ring ring-one"></div><div className="orb-ring ring-two"></div><div className="orb-core"><Sparkles size={33}/></div></div>
          <div className="eyebrow"><span></span> YOUR PERSONAL INTELLIGENCE</div>
          <h1>How can I help<br/><em>you today?</em></h1>
          <p>Speak naturally. Think bigger. Get things done.</p>
          <div className="capability-row"><span><Zap size={14}/> Smart AI</span><span><Mic size={14}/> Voice ready</span><span><CalendarClock size={14}/> Reminders</span></div>
        </div>
        <div className="chat-stream">
          {messages.map(message => <div className={`message ${message.role}`} key={message.id}><div className="message-avatar">{message.role === 'assistant' ? <Cpu size={17}/> : 'YOU'}</div><div className="message-body"><div className="message-label">{message.role === 'assistant' ? 'JARVIS' : 'YOU'}</div><div className="message-text">{message.content}</div></div></div>)}
          {busy && <div className="message assistant"><div className="message-avatar"><Cpu size={17}/></div><div className="message-body"><div className="message-label">JARVIS</div><div className="typing"><i></i><i></i><i></i> Thinking...</div></div></div>}
          <div ref={chatEnd}/>
        </div>
        <div className="composer-wrap">
          <div className="suggestions">
            <button onClick={() => sendMessage('Help me plan my day / என் நாளை திட்டமிட உதவு')}>Plan my day <ArrowUp size={13}/></button>
            <button onClick={() => setReminderOpen(true)}>Create reminder <Plus size={13}/></button>
            <button onClick={() => sendMessage('Explain what you can do on my Android phone')}>Phone features <Smartphone size={13}/></button>
          </div>
          <form className="composer" onSubmit={e => { e.preventDefault(); sendMessage(); }}>
            <button type="button" className={`mic-button ${listening ? 'listening' : ''}`} title="Speak" onClick={() => listening ? recognitionRef.current?.stop() : startListening()}>{listening ? <MicOff size={19}/> : <Mic size={19}/>}</button>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask JARVIS anything… / கேளுங்கள்" aria-label="Message JARVIS"/>
            <button className="send-button" type="submit" disabled={!input.trim() || busy}><ArrowUp size={20}/></button>
          </form>
          <div className="composer-foot"><span><ShieldCheck size={12}/> Private by default on this device</span><span>AI features require a configured model</span></div>
        </div>
      </section> : <section className="reminders-view">
        <div className="section-heading"><div><div className="eyebrow"><span></span> PERSONAL ORGANIZER</div><h1>Your reminders</h1><p>Keep the important things on your radar.</p></div><button className="primary-button" onClick={() => setReminderOpen(true)}><Plus size={17}/> New reminder</button></div>
        <div className="reminder-list">
          {reminders.length === 0 && <div className="empty-state"><CalendarClock size={34}/><h3>No reminders yet</h3><p>Create your first reminder to get started.</p><button className="primary-button" onClick={() => setReminderOpen(true)}><Plus size={16}/> Create reminder</button></div>}
          {reminders.map(r => <div className={`reminder-card ${r.done ? 'done' : ''}`} key={r.id}><div className="reminder-icon"><CalendarClock size={19}/></div><div className="reminder-info"><strong>{r.title}</strong><span>{localDateTime(r.at)} {r.done && '· Completed'}</span></div><button className="icon-button" title="Delete reminder" onClick={() => setReminders(old => old.filter(x => x.id !== r.id))}><Trash2 size={17}/></button></div>)}
        </div>
        <p className="reminder-note"><ShieldCheck size={15}/> Reminders are stored locally. Reliable background alerts require native Android scheduling and notification permission.</p>
      </section>}

      <footer className="footer"><span>JARVIS PERSONAL AI <b>·</b> BUILT FOR YOU</span><span><span className="live-dot"></span> {native ? 'ANDROID APP' : 'WEB MODE'}</span></footer>
    </main>

    {notice && <div className="toast"><Check size={17}/>{notice}<button onClick={() => setNotice('')}><X size={15}/></button></div>}

    {reminderOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setReminderOpen(false); }}><div className="modal">
      <div className="modal-head"><div><span className="eyebrow">PERSONAL ORGANIZER</span><h2>Create reminder</h2></div><button className="icon-button" onClick={() => setReminderOpen(false)}><X size={19}/></button></div>
      <form onSubmit={e => { e.preventDefault(); addReminder(reminderTitle, reminderTime); }}>
        <label>What should I remind you about?<input required value={reminderTitle} onChange={e => setReminderTitle(e.target.value)} placeholder="e.g. Call Amma, take medicine"/></label>
        <label>Date and time<input required type="datetime-local" value={reminderTime} onChange={e => setReminderTime(e.target.value)} min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16)}/></label>
        <button className="primary-button full" type="submit"><Check size={17}/> Save reminder</button>
        <button className="text-button full" type="button" onClick={requestNotificationPermission}>Enable browser notifications</button>
      </form>
    </div></div>}

    {settingsOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}><div className="modal settings-modal">
      <div className="modal-head"><div><span className="eyebrow">CONFIGURATION</span><h2>Assistant settings</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)}><X size={19}/></button></div>
      <p className="modal-intro">Connect any compatible chat-completions endpoint. Settings are saved in this browser/device.</p>
      <form onSubmit={e => { e.preventDefault(); saveSettings(); }}>
        <label>AI endpoint<input value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="https://your-provider.example/v1"/></label>
        <label>Model name<input value={model} onChange={e => setModel(e.target.value)} placeholder="model-name"/></label>
        <label>API key <span className="optional">(optional for local servers)</span><input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Stored locally; avoid shared devices"/></label>
        <label>Preferred language<select value={language} onChange={e => setLanguage(e.target.value)}><option value="auto">Auto (Tamil / English / Tanglish)</option><option value="ta">Tamil</option><option value="en">English</option></select></label>
        <label className="toggle-label"><span><b>Spoken responses</b><small>Read JARVIS replies aloud where supported.</small></span><input type="checkbox" checked={voiceReply} onChange={e => setVoiceReply(e.target.checked)}/></label>
        <div className="security-note"><ShieldCheck size={17}/><span>For a public deployment, do not put a provider API key in frontend code. Use a backend proxy with authentication. Local browser storage is not encrypted.</span></div>
        <button className="primary-button full" type="submit"><Check size={17}/> Save settings</button>
      </form>
    </div></div>}
  </div>;
}